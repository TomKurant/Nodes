class DrawioConverter {
    convert(xmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');

        if (doc.querySelector('parsererror')) {
            throw new Error('Invalid XML file');
        }

        const diagrams = doc.querySelectorAll('diagram');
        if (!diagrams.length) throw new Error('No diagrams found in file');

        const results = [];
        for (const diagram of diagrams) {
            const name = diagram.getAttribute('name') || 'Graph';
            results.push({ name, graph: this._convertDiagram(diagram) });
        }
        return results;
    }

    _convertDiagram(diagram) {
        const cells = diagram.querySelectorAll('mxCell');

        // Pass 1: build cell map
        const cellMap = {};
        for (const cell of cells) {
            const id = cell.getAttribute('id');
            if (!id || id === '0' || id === '1') continue;

            const geoEl = cell.querySelector('mxGeometry');
            cellMap[id] = {
                id,
                parent:   cell.getAttribute('parent') || '1',
                value:    cell.getAttribute('value')  || '',
                style:    cell.getAttribute('style')  || '',
                isVertex: cell.getAttribute('vertex') === '1',
                isEdge:   cell.getAttribute('edge')   === '1',
                source:   cell.getAttribute('source'),
                target:   cell.getAttribute('target'),
                geometry: geoEl ? {
                    x:      parseFloat(geoEl.getAttribute('x')      || 0),
                    y:      parseFloat(geoEl.getAttribute('y')      || 0),
                    width:  parseFloat(geoEl.getAttribute('width')  || 0),
                    height: parseFloat(geoEl.getAttribute('height') || 0),
                } : { x: 0, y: 0, width: 0, height: 0 },
            };
        }

        // Pass 2: find container cells (have at least one child pointing to them)
        const containerIds = new Set();
        for (const cell of Object.values(cellMap)) {
            const p = cell.parent;
            if (p && p !== '0' && p !== '1') containerIds.add(p);
        }

        // Pass 3: collect leaf vertices (non-containers)
        const leafIds = Object.keys(cellMap).filter(id => {
            const c = cellMap[id];
            return c.isVertex && !containerIds.has(id);
        });

        // Pass 4: absolute positions (recurse up parent chain)
        const absPos = (id, visited = new Set()) => {
            if (visited.has(id)) return { x: 0, y: 0 };
            visited.add(id);
            const cell = cellMap[id];
            if (!cell) return { x: 0, y: 0 };
            const { x, y } = cell.geometry;
            const p = cell.parent;
            if (!p || p === '0' || p === '1') return { x, y };
            const pp = absPos(p, visited);
            return { x: x + pp.x, y: y + pp.y };
        };

        const positions = {};
        for (const id of leafIds) positions[id] = absPos(id);

        // Center & scale
        const xs = Object.values(positions).map(p => p.x);
        const ys = Object.values(positions).map(p => p.y);
        if (!xs.length) return { nodes: [], links: [], nextNodeId: 0, nextLinkId: 0 };

        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const SCALE = 0.35;

        // Build nodes
        const nodes = [];
        const idMap = {}; // drawio id → sequential id
        let nodeId = 0;

        for (const id of leafIds) {
            const cell = cellMap[id];
            const pos  = positions[id];
            idMap[id]  = nodeId;

            let nodeName, comments;
            if (cell.style.includes('shape=process')) {
                const parsed = this._parseProcessCell(cell.value);
                nodeName = parsed.name || this._extractText(cell.value) || id;
                const ts = new Date().toLocaleString();
                comments = parsed.columns.map(col => ({ text: col, timestamp: ts }));
            } else {
                nodeName = this._extractText(cell.value) || id;
                comments = [];
            }

            nodes.push({
                id:       nodeId++,
                name:     nodeName,
                type:     this._extractShapeType(cell.style),
                color:    this._extractFillColor(cell.style),
                x:        (pos.x - cx) * SCALE,
                y:        (pos.y - cy) * SCALE,
                comments,
            });
        }

        // Build links — only between included nodes
        const links = [];
        let linkId = 0;

        for (const cell of Object.values(cellMap)) {
            if (!cell.isEdge || !cell.source || !cell.target) continue;
            const srcId = idMap[cell.source];
            const tgtId = idMap[cell.target];
            if (srcId === undefined || tgtId === undefined) continue;
            if (srcId === tgtId) continue;

            const label = this._extractText(cell.value);
            links.push({
                id:       linkId++,
                sourceId: srcId,
                targetId: tgtId,
                name:     label,
                type:     '',
                color:    this._extractStrokeColor(cell.style),
                comments: [],
            });
        }

        return { nodes, links, nextNodeId: nodes.length, nextLinkId: links.length };
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    _extractText(html) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
    }

    _pickFirstHex(val) {
        // Resolve light-dark(#aaa, #bbb) → #aaa
        const ld = val.match(/light-dark\(\s*(#[0-9a-fA-F]{3,8})/);
        if (ld) return ld[1];
        const hex = val.match(/#[0-9a-fA-F]{3,8}/);
        return hex ? hex[0] : null;
    }

    _extractFillColor(style) {
        const m = style.match(/fillColor=([^;]+)/);
        if (!m) return '#3498db';
        const raw = m[1].trim();
        if (raw === 'none' || raw === 'default') return '#3498db';
        return this._pickFirstHex(raw) || '#3498db';
    }

    _extractStrokeColor(style) {
        const m = style.match(/strokeColor=([^;]+)/);
        if (!m) return '#2c3e50';
        const raw = m[1].trim();
        if (raw === 'none' || raw === 'default') return '#2c3e50';
        return this._pickFirstHex(raw) || '#2c3e50';
    }

    _parseProcessCell(html) {
        if (!html) return { name: '', columns: [] };

        const container = document.createElement('div');
        container.innerHTML = html;

        const underlined = container.querySelector('u');
        if (!underlined) {
            return { name: (container.textContent || '').replace(/\s+/g, ' ').trim(), columns: [] };
        }

        const name = underlined.textContent.replace(/\s+/g, ' ').trim();

        const columns = [];
        for (const child of Array.from(container.childNodes)) {
            // Skip the node that is or contains the <u> element
            if (child === underlined || (child.contains && child.contains(underlined))) continue;
            const text = (child.textContent || '').replace(/\s+/g, ' ').trim();
            if (text) columns.push(text);
        }

        return { name, columns };
    }

    _extractShapeType(style) {
        const m = style.match(/shape=([^;,]+)/);
        if (m) {
            // Strip vendor prefixes like mxgraph.basic.
            return m[1].trim().replace(/^mxgraph\.[^.]+\./, '');
        }
        if (style.includes('swimlane')) return 'swimlane';
        if (style.includes('image;'))   return 'image';
        return '';
    }
}

const drawioConverter = new DrawioConverter();

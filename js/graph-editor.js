class GraphEditor {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.nodes = [];
        this.links = [];
        this.nextNodeId = 0;
        this.nextLinkId = 0;

        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;
        this.minScale = 0.1;
        this.maxScale = 3;

        this.selectedNode = null;
        this.selectedLink = null;
        this.selectedNodes = new Set();
        this.draggingNode = null;
        this.panningMouse = null;
        this.rubberBand = null;
        this._dragGroupOrigin = null;
        this._groupDragStartPositions = null;

        this.centerForce = 2.5;
        this.repulsionForce = 100000;
        this.linkAttractionForce = 0.01;
        this.defaultLinkDistance = 0.5;
        this.damping = 0;
        this.maxVelocity = 10;

        this.rotateLinkLabels = true;
        this.labelsAboveArrow = false;
        this.showIndicatorRings = false;
        this.showCycles = false;
        this.showCriticalPath = false;
        this.showReachability    = false;
        this.showBetweenness     = false;
        this._graphVersion       = 0;
        this._cycleVersion       = -1;
        this._criticalVersion    = -1;
        this._betweennessVersion = -1;
        this._cycleResult        = { cycleNodeIds: null, cycleLinkIds: null };
        this._criticalResult     = { pathNodeIds: null, pathLinkIds: null };
        this._reachabilityResult = { forwardIds: new Set(), backwardIds: new Set(), sourceId: null };
        this._betweennessScores  = null;
        this.showGrid = true;
        this.showNodeIds = false;
        this.redNodeForce = 0;
        this.greenNodeForce = 0;
        this.selectedLogo = 'default';
        this.searchTerm = '';
        this._undoStack = [];
        this._redoStack = [];
        this.viewerMode = false;
        this.viewerSidebarHidden = false;
        this.activeTags = new Set();
        this.globalTags = [];
        this.nodeRadius = 30;

        this.graphFile = new URLSearchParams(window.location.search).get('graph');

        this.resizeCanvas();
        this.offsetX = this.canvas.width / 2;
        this.offsetY = this.canvas.height / 2;
        this.setupEventListeners();
        this.setupSearchBar();
        this.setupFormListeners();
        this.setupThemeListener();
        this.setupForceControls();
        this.setupDisplayControls();
        this.setupCollapsiblePanels();
        this.setupViewerMode();
        this.setupTagsPanel();
        this.animate();
        this.initData();
    }

    getCanvasBackgroundColor() {
        const computedStyle = window.getComputedStyle(document.documentElement);
        return computedStyle.getPropertyValue('--canvas-bg').trim();
    }

    getGridColor() {
        const computedStyle = window.getComputedStyle(document.documentElement);
        return computedStyle.getPropertyValue('--grid-color').trim();
    }

    getTextColor() {
        const computedStyle = window.getComputedStyle(document.documentElement);
        return computedStyle.getPropertyValue('--text-color').trim();
    }

    getLinkColor() {
        const computedStyle = window.getComputedStyle(document.documentElement);
        return computedStyle.getPropertyValue('--link-color').trim() || '#000000';
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());

        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));

        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    setupSearchBar() {
        const input = document.getElementById('searchInput');
        if (!input) return;
        input.addEventListener('input', () => {
            this.searchTerm = input.value.trim().toLowerCase();
        });
        // Prevent canvas Delete key from firing while typing in search
        input.addEventListener('keydown', (e) => e.stopPropagation());
    }

    onDoubleClick(e) {
        if (this.viewerMode) return;
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.offsetX) / this.scale;
        const mouseY = (e.clientY - rect.top - this.offsetY) / this.scale;

        for (let i = this.nodes.length - 1; i >= 0; i--) {
            if (this.nodes[i].contains(mouseX, mouseY)) {
                this.startInlineRename(this.nodes[i]);
                return;
            }
        }

        const linkOffsets = this._getLinkOffsets();
        for (let i = this.links.length - 1; i >= 0; i--) {
            const src = this.nodes.find(n => n.id === this.links[i].sourceId);
            const tgt = this.nodes.find(n => n.id === this.links[i].targetId);
            if (src && tgt && this.links[i].hitTest(mouseX, mouseY, src, tgt, linkOffsets.get(this.links[i].id) ?? 0)) {
                this.startInlineLinkRename(this.links[i], src, tgt);
                return;
            }
        }
    }

    startInlineRename(node) {
        const existing = document.getElementById('inlineRenameInput');
        if (existing) existing.remove();

        const rect = this.canvas.getBoundingClientRect();
        const screenX = node.x * this.scale + this.offsetX + rect.left;
        const screenY = node.y * this.scale + this.offsetY + rect.top;

        const input = document.createElement('input');
        input.id = 'inlineRenameInput';
        input.type = 'text';
        input.value = node.name;
        input.className = 'inline-rename-input';

        const width = 140;
        input.style.left = `${screenX - width / 2}px`;
        input.style.top  = `${screenY - 13}px`;
        input.style.width = `${width}px`;

        document.body.appendChild(input);
        input.focus();
        input.select();

        const commit = () => {
            const newName = input.value.trim();
            if (newName && newName !== node.name) {
                this._pushHistory();
                node.name = newName;
                this.saveDataBackground();
            }
            input.remove();
        };

        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') input.remove();
        });
        input.addEventListener('blur', commit);
    }

    startInlineLinkRename(link, sourceNode, targetNode) {
        const existing = document.getElementById('inlineRenameInput');
        if (existing) existing.remove();

        const rect = this.canvas.getBoundingClientRect();
        let midX, midY;
        if (sourceNode.id === targetNode.id) {
            const r   = sourceNode.radius;
            const ext = r * 2.8;
            midX = sourceNode.x * this.scale + this.offsetX + rect.left;
            midY = (sourceNode.y - r - ext * 0.55) * this.scale + this.offsetY + rect.top;
        } else {
            const curveOffset = (this._getLinkOffsets().get(link.id) ?? 0);
            if (curveOffset !== 0) {
                const dx    = targetNode.x - sourceNode.x;
                const dy    = targetNode.y - sourceNode.y;
                const angle = Math.atan2(dy, dx);
                const d     = Link.CURVE_DELTA;
                const R     = sourceNode.radius;
                const sx    = sourceNode.x + Math.cos(angle + d) * R;
                const sy    = sourceNode.y + Math.sin(angle + d) * R;
                const ex    = targetNode.x + Math.cos(angle + Math.PI - d) * R;
                const ey    = targetNode.y + Math.sin(angle + Math.PI - d) * R;
                const cpX   = (sx + ex) / 2 + (-Math.sin(angle)) * curveOffset;
                const cpY   = (sy + ey) / 2 + Math.cos(angle) * curveOffset;
                // Bezier midpoint at t=0.5
                const wmx   = 0.25 * sx + 0.5 * cpX + 0.25 * ex;
                const wmy   = 0.25 * sy + 0.5 * cpY + 0.25 * ey;
                midX = wmx * this.scale + this.offsetX + rect.left;
                midY = wmy * this.scale + this.offsetY + rect.top;
            } else {
                midX = (sourceNode.x + targetNode.x) / 2 * this.scale + this.offsetX + rect.left;
                midY = (sourceNode.y + targetNode.y) / 2 * this.scale + this.offsetY + rect.top;
            }
        }

        const input = document.createElement('input');
        input.id = 'inlineRenameInput';
        input.type = 'text';
        input.value = link.name || '';
        input.placeholder = 'Arrow name…';
        input.className = 'inline-rename-input';

        const width = 140;
        input.style.left  = `${midX - width / 2}px`;
        input.style.top   = `${midY - 13}px`;
        input.style.width = `${width}px`;

        document.body.appendChild(input);
        input.focus();
        input.select();

        const commit = () => {
            const newName = input.value.trim();
            if (newName !== link.name) {
                this._pushHistory();
                link.name = newName;
                this.saveDataBackground();
            }
            input.remove();
        };

        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') input.remove();
        });
        input.addEventListener('blur', commit);
    }

    setupFormListeners() {
        document.getElementById('nodeForm').addEventListener('submit', (e) => this.addNode(e));
        document.getElementById('linkForm').addEventListener('submit', (e) => this.addLink(e));
        document.getElementById('clearAllBtn')?.addEventListener('click', () => this.clearAll());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('exportSvgBtn').addEventListener('click', () => this.exportSVG());
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('fileInput').addEventListener('change', (e) => this.importData(e));
        document.getElementById('saveToFolderBtn').addEventListener('click', () => this.saveToFolder());
        document.getElementById('screenshotBtn').addEventListener('click', () => this.takeScreenshot());
    }

    takeScreenshot() {
        const dataURL = this.canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = `graph-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    setupThemeListener() {
        window.addEventListener('themeChanged', () => {
            // Redraw happens automatically in the animation loop
        });
    }

    setupForceControls() {
        const DEFAULTS = {
            centerForce:          2.5,
            repulsionForce:       100000,
            linkAttractionForce:  0.01,
            defaultLinkDistance:  0.5,
            damping:              0.5,
            maxVelocity:          10,
        };

        const controls = [
            { slider: 'centerForceSlider',    val: 'centerForceVal',    prop: 'centerForce'         },
            { slider: 'repulsionSlider',      val: 'repulsionVal',      prop: 'repulsionForce'       },
            { slider: 'linkAttractionSlider', val: 'linkAttractionVal', prop: 'linkAttractionForce'  },
            { slider: 'linkDistanceSlider',   val: 'linkDistanceVal',   prop: 'defaultLinkDistance'  },
            { slider: 'dampingSlider',        val: 'dampingVal',        prop: 'damping'              },
            { slider: 'maxVelocitySlider',    val: 'maxVelocityVal',    prop: 'maxVelocity'          },
        ];

        const sync = () => {
            for (const { slider, val, prop } of controls) {
                const el  = document.getElementById(slider);
                const lbl = document.getElementById(val);
                if (!el) continue;
                el.value        = this[prop];
                lbl.textContent = el.value;
            }
        };

        for (const { slider, val, prop } of controls) {
            const el  = document.getElementById(slider);
            const lbl = document.getElementById(val);
            if (!el) continue;
            el.value        = this[prop];
            lbl.textContent = el.value;
            el.addEventListener('input', () => {
                this[prop]      = parseFloat(el.value);
                lbl.textContent = el.value;
            });
        }

        document.getElementById('resetForcesBtn').addEventListener('click', () => {
            Object.assign(this, DEFAULTS);
            sync();
        });

        document.getElementById('stopMovementBtn').addEventListener('click', () => {
            this.damping = 0;
            sync();
        });

        document.getElementById('compactBtn').addEventListener('click', () => {
            Object.assign(this, { centerForce: 10, repulsionForce: 150000, linkAttractionForce: 0.07, defaultLinkDistance: 5, damping: 0.1, maxVelocity: 1 });
            sync();
        });

        document.getElementById('fastGroupingBtn').addEventListener('click', () => {
            Object.assign(this, { centerForce: 10, repulsionForce: 500000, linkAttractionForce: 0.2, defaultLinkDistance: 150, damping: 0.8, maxVelocity: 100 });
            sync();
        });
    }

    setupCollapsiblePanels() {
        const openByDefault = new Set([]);
        document.querySelectorAll('.sidebar .panel').forEach(panel => {
            const h3 = panel.querySelector(':scope > h3');
            if (!h3) return;
            h3.classList.add('panel-header');
            const body = document.createElement('div');
            body.className = 'panel-body';
            const children = [];
            let next = h3.nextElementSibling;
            while (next) { children.push(next); next = next.nextElementSibling; }
            children.forEach(c => body.appendChild(c));
            panel.appendChild(body);
            if (!openByDefault.has(h3.textContent.trim())) {
                panel.classList.add('collapsed');
            }
            h3.addEventListener('click', () => panel.classList.toggle('collapsed'));
        });
    }

    setupDisplayControls() {
        const wire = (id, prop) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => { this[prop] = el.checked; });
        };
        wire('showGrid',    'showGrid');
        wire('showNodeIds', 'showNodeIds');

        const rotateCb      = document.getElementById('rotateLinkLabels');
        const aboveCont     = document.getElementById('labelsAboveContainer');
        const aboveCb       = document.getElementById('labelsAboveArrow');

        const syncRotateSub = () => {
            if (!aboveCont) return;
            if (this.rotateLinkLabels) {
                aboveCont.style.display = '';
            } else {
                aboveCont.style.display = 'none';
                this.labelsAboveArrow = false;
                if (aboveCb) aboveCb.checked = false;
            }
        };

        if (rotateCb) {
            rotateCb.addEventListener('change', () => {
                this.rotateLinkLabels = rotateCb.checked;
                syncRotateSub();
            });
            syncRotateSub();
        }
        if (aboveCb) {
            aboveCb.addEventListener('change', () => { this.labelsAboveArrow = aboveCb.checked; });
        }

        wire('showCycles',       'showCycles');
        wire('showCriticalPath', 'showCriticalPath');

        const reachCb = document.getElementById('showReachability');
        if (reachCb) {
            reachCb.addEventListener('change', () => {
                this.showReachability = reachCb.checked;
                if (!reachCb.checked)
                    this._reachabilityResult = { forwardIds: new Set(), backwardIds: new Set(), sourceId: null };
            });
        }
        wire('showBetweenness', 'showBetweenness');

        const ringsCheckbox     = document.getElementById('showIndicatorRings');
        const ringForceControls = document.getElementById('ringForceControls');

        const syncRingForces = (enabled) => {
            if (ringForceControls) ringForceControls.style.display = enabled ? '' : 'none';
            if (!enabled) {
                this.redNodeForce = 0;
                this.greenNodeForce = 0;
                const rs = document.getElementById('redNodeForceSlider');
                const gs = document.getElementById('greenNodeForceSlider');
                if (rs) { rs.value = 0; document.getElementById('redNodeForceVal').textContent = '0'; }
                if (gs) { gs.value = 0; document.getElementById('greenNodeForceVal').textContent = '0'; }
            }
        };

        if (ringsCheckbox) {
            ringsCheckbox.addEventListener('change', () => {
                this.showIndicatorRings = ringsCheckbox.checked;
                syncRingForces(ringsCheckbox.checked);
            });
            syncRingForces(ringsCheckbox.checked);
        }

        const wireForce = (sliderId, valId, prop) => {
            const slider = document.getElementById(sliderId);
            const valEl  = document.getElementById(valId);
            if (!slider) return;
            slider.addEventListener('input', () => {
                this[prop] = parseFloat(slider.value);
                if (valEl) valEl.textContent = slider.value;
            });
        };
        wireForce('redNodeForceSlider',   'redNodeForceVal',   'redNodeForce');
        wireForce('greenNodeForceSlider', 'greenNodeForceVal', 'greenNodeForce');

        const nodeSizeSlider = document.getElementById('nodeSizeSlider');
        const nodeSizeVal    = document.getElementById('nodeSizeVal');
        if (nodeSizeSlider) {
            nodeSizeSlider.addEventListener('input', () => {
                this.nodeRadius = parseInt(nodeSizeSlider.value);
                if (nodeSizeVal) nodeSizeVal.textContent = nodeSizeSlider.value;
                for (const node of this.nodes) node.radius = this.nodeRadius;
            });
        }

        const showLogoCb  = document.getElementById('showLogo');
        const logoCont    = document.getElementById('logoSelectorContainer');
        if (showLogoCb) {
            showLogoCb.addEventListener('change', () => {
                if (showLogoCb.checked) {
                    if (!this.selectedLogo) this.selectedLogo = 'default';
                    if (logoCont) logoCont.style.display = '';
                } else {
                    this.selectedLogo = null;
                    if (logoCont) logoCont.style.display = 'none';
                }
                this._applyLogoSelection();
                this.saveDataBackground();
            });
        }
        this._buildLogoSelector();
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.offsetX) / this.scale;
        const mouseY = (e.clientY - rect.top - this.offsetY) / this.scale;

        if (e.button === 0) {
            for (let i = this.nodes.length - 1; i >= 0; i--) {
                const node = this.nodes[i];
                if (node.contains(mouseX, mouseY)) {
                    if (e.shiftKey) {
                        if (this.selectedNodes.has(node.id)) {
                            this.selectedNodes.delete(node.id);
                        } else {
                            this.selectedNodes.add(node.id);
                        }
                        this.selectedNode = null;
                        this.selectedLink = null;
                    } else if (this.selectedNodes.size > 0 && this.selectedNodes.has(node.id)) {
                        if (!this.viewerMode) {
                            this.draggingNode = node;
                            this._dragGroupOrigin = { x: mouseX, y: mouseY };
                            this._groupDragStartPositions = {};
                            for (const n of this.nodes) {
                                if (this.selectedNodes.has(n.id)) {
                                    this._groupDragStartPositions[n.id] = { x: n.x, y: n.y };
                                }
                            }
                        }
                    } else {
                        this.selectedNodes.clear();
                        this.selectedNode = node;
                        this.selectedLink = null;
                        if (!this.viewerMode) this.draggingNode = node;
                    }
                    this.updateSelectedInfo();
                    this.updateCommentButtonVisibility();
                    if (this.viewerMode && this.selectedNode) this.showViewerInfo(this.selectedNode, 'node');
                    return;
                }
            }

            if (!e.shiftKey) {
                const linkOffsets = this._getLinkOffsets();
                for (let i = this.links.length - 1; i >= 0; i--) {
                    const sourceNode = this.nodes.find(n => n.id === this.links[i].sourceId);
                    const targetNode = this.nodes.find(n => n.id === this.links[i].targetId);
                    if (sourceNode && targetNode && this.links[i].hitTest(mouseX, mouseY, sourceNode, targetNode, linkOffsets.get(this.links[i].id) ?? 0)) {
                        this.selectedLink = this.links[i];
                        this.selectedNode = null;
                        this.selectedNodes.clear();
                        this.updateSelectedInfo();
                        this.updateCommentButtonVisibility();
                        if (this.viewerMode) this.showViewerInfo(this.selectedLink, 'link');
                        return;
                    }
                }

                this.selectedNode = null;
                this.selectedLink = null;
                this.selectedNodes.clear();
                this.updateSelectedInfo();
                this.updateCommentButtonVisibility();
                if (this.viewerMode) this.hideViewerInfo();
            }

            this.rubberBand = { startX: mouseX, startY: mouseY, endX: mouseX, endY: mouseY };
        } else if (e.button === 2) {
            this.panningMouse = { x: e.clientX, y: e.clientY, offsetX: this.offsetX, offsetY: this.offsetY };
        }
    }

    onMouseMove(e) {
        if (this.draggingNode) {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - this.offsetX) / this.scale;
            const mouseY = (e.clientY - rect.top - this.offsetY) / this.scale;
            if (this._dragGroupOrigin) {
                const dx = mouseX - this._dragGroupOrigin.x;
                const dy = mouseY - this._dragGroupOrigin.y;
                for (const n of this.nodes) {
                    const start = this._groupDragStartPositions[n.id];
                    if (start) { n.x = start.x + dx; n.y = start.y + dy; }
                }
            } else {
                this.draggingNode.x = mouseX;
                this.draggingNode.y = mouseY;
            }
        } else if (this.rubberBand) {
            const rect = this.canvas.getBoundingClientRect();
            this.rubberBand.endX = (e.clientX - rect.left - this.offsetX) / this.scale;
            this.rubberBand.endY = (e.clientY - rect.top - this.offsetY) / this.scale;
        } else if (this.panningMouse) {
            const dx = e.clientX - this.panningMouse.x;
            const dy = e.clientY - this.panningMouse.y;
            this.offsetX = this.panningMouse.offsetX + dx;
            this.offsetY = this.panningMouse.offsetY + dy;
        }
    }

    onMouseUp(e) {
        if (this.rubberBand) {
            const { startX, startY, endX, endY } = this.rubberBand;
            const minX = Math.min(startX, endX);
            const maxX = Math.max(startX, endX);
            const minY = Math.min(startY, endY);
            const maxY = Math.max(startY, endY);
            if (maxX - minX > 5 || maxY - minY > 5) {
                this.selectedNodes.clear();
                for (const node of this.nodes) {
                    if (node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY) {
                        this.selectedNodes.add(node.id);
                    }
                }
                this.selectedNode = null;
                this.selectedLink = null;
                this.updateSelectedInfo();
                this.updateCommentButtonVisibility();
                if (this.viewerMode) this.hideViewerInfo();
            }
            this.rubberBand = null;
        }
        this.draggingNode = null;
        this._dragGroupOrigin = null;
        this._groupDragStartPositions = null;
        this.panningMouse = null;
        this.saveDataBackground();
    }

    onWheel(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const scrollDelta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * scrollDelta));

        this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / this.scale);
        this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / this.scale);

        this.scale = newScale;
    }

    onKeyDown(e) {
        if (e.key === 'Delete') {
            if (this.viewerMode) return;
            if (this.selectedNodes.size > 0) {
                this._pushHistory();
                for (const id of this.selectedNodes) {
                    this.nodes = this.nodes.filter(n => n.id !== id);
                    this.links = this.links.filter(l => l.sourceId !== id && l.targetId !== id);
                }
                this._invalidateAnalysis();
                this.selectedNodes.clear();
                this.selectedNode = null;
                this.updateSelectedInfo();
                this.updateCommentButtonVisibility();
                this.updateStats();
                this.saveDataBackground();
            } else if (this.selectedNode) {
                this.deleteNode(this.selectedNode.id);
            } else if (this.selectedLink) {
                this.deleteLink(this.selectedLink.id);
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            this.undo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            this.redo();
        }
    }

    addNode(e) {
        e.preventDefault();
        this._pushHistory();

        const name = document.getElementById('nodeName').value;
        const type = document.getElementById('nodeType').value;
        const color = document.getElementById('nodeColor').value;

        const x = (this.canvas.width / 2 - this.offsetX) / this.scale + (Math.random() - 0.5) * 100;
        const y = (this.canvas.height / 2 - this.offsetY) / this.scale + (Math.random() - 0.5) * 100;

        const node = new Node(this.nextNodeId++, name, type, color, x, y);
        node.definition = '';
        node.comments = [];
        node.tags = [];
        node.radius = this.nodeRadius;
        this.nodes.push(node);
        this._invalidateAnalysis();

        document.getElementById('nodeForm').reset();
        document.getElementById('nodeColor').value = '#3498db';
        this.updateStats();
        this.saveDataBackground();
    }

    _showLinkStatus(msg, isError = false) {
        let banner = document.getElementById('_linkStatusBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = '_linkStatusBanner';
            banner.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:bold;box-shadow:0 3px 12px rgba(0,0,0,0.3);pointer-events:none;transition:opacity 0.4s';
            document.body.appendChild(banner);
        }
        banner.textContent = msg;
        banner.style.background = isError ? '#e74c3c' : '#27ae60';
        banner.style.color = '#fff';
        banner.style.opacity = '1';
        clearTimeout(banner._hideTimer);
        banner._hideTimer = setTimeout(() => { banner.style.opacity = '0'; }, 2500);
    }

    addLink(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const sourceId = parseInt(document.getElementById('sourceNode').value);
        const targetId = parseInt(document.getElementById('targetNode').value);
        const name = document.getElementById('linkName').value;
        const type = document.getElementById('linkType').value;

        if (isNaN(sourceId) || isNaN(targetId)) {
            this._showLinkStatus(`Invalid IDs — got: "${document.getElementById('sourceNode').value}" → "${document.getElementById('targetNode').value}"`, true);
            return;
        }

        const sourceNode = this.nodes.find(n => n.id === sourceId);
        const targetNode = this.nodes.find(n => n.id === targetId);

        if (!sourceNode) { this._showLinkStatus(`No node with ID ${sourceId} (graph has ${this.nodes.length} nodes)`, true); return; }
        if (!targetNode) { this._showLinkStatus(`No node with ID ${targetId} (graph has ${this.nodes.length} nodes)`, true); return; }

        const sameDirCount = this.links.filter(l => l.sourceId === sourceId && l.targetId === targetId).length;
        const revDirCount  = this.links.filter(l => l.sourceId === targetId && l.targetId === sourceId).length;
        if (sameDirCount >= 5) { this._showLinkStatus(`Max 5 arrows in one direction (already ${sameDirCount})`, true); return; }
        if (sameDirCount + revDirCount >= 10) { this._showLinkStatus(`Max 10 arrows between two nodes (already ${sameDirCount + revDirCount})`, true); return; }

        this._pushHistory();
        const link = new Link(this.nextLinkId++, sourceId, targetId, name, type, '');
        link.comments = [];
        this.links.push(link);
        this._invalidateAnalysis();

        document.getElementById('linkForm').reset();
        this.updateStats();
        this.saveDataBackground();
        this._showLinkStatus(`Arrow #${sourceId} → #${targetId} added (${sameDirCount + 1} in this direction)`);
    }

    deleteNode(nodeId) {
        this._pushHistory();
        this.nodes = this.nodes.filter(n => n.id !== nodeId);
        this.links = this.links.filter(l => l.sourceId !== nodeId && l.targetId !== nodeId);
        this._invalidateAnalysis();
        this.selectedNode = null;
        this.updateSelectedInfo();
        this.updateStats();
        this.saveDataBackground();
    }

    deleteLink(linkId) {
        this._pushHistory();
        this.links = this.links.filter(l => l.id !== linkId);
        this._invalidateAnalysis();
        this.selectedLink = null;
        this.updateSelectedInfo();
        this.updateStats();
        this.saveDataBackground();
    }

    clearAll() {
        if (confirm('Are you sure you want to clear all nodes and arrows?')) {
            this._pushHistory();
            this.nodes = [];
            this.links = [];
            this._invalidateAnalysis();
            this.nextNodeId = 0;
            this.nextLinkId = 0;
            this.selectedNode = null;
            this.selectedLink = null;
            this.updateSelectedInfo();
            this.updateStats();
            this.saveDataBackground();
        }
    }

    updateSelectedInfo() {
        const infoDiv = document.getElementById('selectedInfo');
        if (this.selectedNodes.size > 0) {
            infoDiv.innerHTML = `<strong>${this.selectedNodes.size} nodes selected</strong><br>Drag to move group &middot; Delete to remove all`;
        } else if (this.selectedNode) {
            const defVal = this._esc(this.selectedNode.definition || '');
            infoDiv.innerHTML = `
                <strong>Node: ${this.selectedNode.name}</strong> (#${this.selectedNode.id})<br>
                Type: ${this.selectedNode.type || 'N/A'}<br>
                Press Delete to remove
                <div class="definition-editor">
                    <label class="definition-label">Definition</label>
                    <textarea id="nodeDefinitionInput" class="definition-textarea" placeholder="Write a definition…">${defVal}</textarea>
                </div>
            `;
            const defInput = document.getElementById('nodeDefinitionInput');
            if (defInput) {
                defInput.addEventListener('input', () => {
                    this.selectedNode.definition = defInput.value;
                    this.saveDataBackground();
                });
            }
        } else if (this.selectedLink) {
            infoDiv.innerHTML = `
                <strong>Arrow:</strong> #${this.selectedLink.sourceId} → #${this.selectedLink.targetId}<br>
                Name: ${this.selectedLink.name || 'N/A'}<br>
                Type: ${this.selectedLink.type || 'N/A'}<br>
                Press Delete to remove
            `;
        } else {
            infoDiv.innerHTML = 'No element selected';
        }
        this._updateDevTagsPanel();
    }

    updateStats() {
        document.getElementById('nodeCount').textContent = this.nodes.length;
        document.getElementById('linkCount').textContent = this.links.length;
    }

    exportData() {
        const data = {
            nodes: this.nodes.map(n => ({
                id: n.id,
                name: n.name,
                type: n.type,
                color: n.color,
                x: n.x,
                y: n.y,
                comments: n.comments || [],
                tags: n.tags || []
            })),
            links: this.links.map(l => ({
                id: l.id,
                sourceId: l.sourceId,
                targetId: l.targetId,
                name: l.name,
                type: l.type,
                color: l.color,
                comments: l.comments || []
            })),
            globalTags: [...this.globalTags],
            nodeRadius: this.nodeRadius,
            selectedLogo: this.selectedLogo
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `graph-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                this._pushHistory();
                const data = JSON.parse(event.target.result);
                this.nodes = data.nodes.map(n => {
                    const node = new Node(n.id, n.name, n.type, n.color, n.x, n.y);
                    node.definition = n.definition || '';
                    node.comments = Array.isArray(n.comments) ? n.comments : [];
                    node.tags = Array.isArray(n.tags) ? n.tags : [];
                    return node;
                });
                this.links = data.links.map(l => {
                    const link = new Link(l.id, l.sourceId, l.targetId, l.name, l.type, l.color);
                    link.comments = Array.isArray(l.comments) ? l.comments : [];
                    return link;
                });

                this.nextNodeId = Math.max(...this.nodes.map(n => n.id), -1) + 1;
                this.nextLinkId = Math.max(...this.links.map(l => l.id), -1) + 1;
                this.globalTags = Array.isArray(data.globalTags) ? data.globalTags :
                    [...new Set(this.nodes.flatMap(n => n.tags || []))].sort();
                this.nodeRadius = data.nodeRadius || 30;
                for (const node of this.nodes) node.radius = this.nodeRadius;
                this.selectedLogo = data.selectedLogo !== undefined ? data.selectedLogo : 'default';
                this._invalidateAnalysis();

                this.selectedNode = null;
                this.selectedLink = null;
                this.activeTags.clear();
                this.updateSelectedInfo();
                this.updateStats();
                this.updateTagsUI();
                this._syncNodeSizeUI();
                this._syncLogoUI();
                this.saveDataBackground();
            } catch (error) {
                alert('Error importing file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    loadFromLocalStorage() {
        const data = localStorage.getItem('graphData');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.nodes = parsed.nodes.map(n => {
                    const node = new Node(n.id, n.name, n.type, n.color, n.x, n.y);
                    node.definition = n.definition || '';
                    node.comments = Array.isArray(n.comments) ? n.comments : [];
                    node.tags = Array.isArray(n.tags) ? n.tags : [];
                    return node;
                });
                this.links = parsed.links.map(l => {
                    const link = new Link(l.id, l.sourceId, l.targetId, l.name, l.type, l.color);
                    link.comments = Array.isArray(l.comments) ? l.comments : [];
                    return link;
                });
                this.nextNodeId = parsed.nextNodeId || 0;
                this.nextLinkId = parsed.nextLinkId || 0;
                this.globalTags = Array.isArray(parsed.globalTags) ? parsed.globalTags :
                    [...new Set(this.nodes.flatMap(n => n.tags || []))].sort();
                this.nodeRadius = parsed.nodeRadius || 30;
                for (const node of this.nodes) node.radius = this.nodeRadius;
                this.selectedLogo = parsed.selectedLogo !== undefined ? parsed.selectedLogo : 'default';
                this._invalidateAnalysis();
                this.updateStats();
            } catch (error) {
                console.error('Error loading from local storage:', error);
            }
        }
    }

    async initData() {
        if (this.graphFile) {
            try {
                const data = await graphStorage.loadGraph(this.graphFile);
                this.nodes = data.nodes.map(n => {
                    const node = new Node(n.id, n.name, n.type, n.color, n.x, n.y);
                    node.definition = n.definition || '';
                    node.comments = Array.isArray(n.comments) ? n.comments : [];
                    node.tags = Array.isArray(n.tags) ? n.tags : [];
                    return node;
                });
                this.links = data.links.map(l => {
                    const link = new Link(l.id, l.sourceId, l.targetId, l.name, l.type, l.color);
                    link.comments = Array.isArray(l.comments) ? l.comments : [];
                    return link;
                });
                this.nextNodeId = data.nextNodeId || 0;
                this.nextLinkId = data.nextLinkId || 0;
                this.globalTags = Array.isArray(data.globalTags) ? data.globalTags :
                    [...new Set(this.nodes.flatMap(n => n.tags || []))].sort();
                this.nodeRadius = data.nodeRadius || 30;
                for (const node of this.nodes) node.radius = this.nodeRadius;
                this.selectedLogo = data.selectedLogo !== undefined ? data.selectedLogo : 'default';
                this._invalidateAnalysis();
            } catch (e) {
                console.error('Failed to load graph file:', e);
                alert('Could not load graph. Please return to menu and grant folder access.');
            }
        } else {
            this.loadFromLocalStorage();
        }
        this.updateStats();
        this.updateTagsUI();
        this._syncNodeSizeUI();
        this._syncLogoUI();
    }

    _buildSaveData() {
        return {
            nodes: this.nodes.map(n => ({
                id: n.id, name: n.name, type: n.type, color: n.color, x: n.x, y: n.y,
                definition: n.definition || '', comments: n.comments || [], tags: n.tags || []
            })),
            links: this.links.map(l => ({
                id: l.id, sourceId: l.sourceId, targetId: l.targetId,
                name: l.name, type: l.type, color: l.color, comments: l.comments || []
            })),
            nextNodeId: this.nextNodeId,
            nextLinkId: this.nextLinkId,
            globalTags: [...this.globalTags],
            nodeRadius: this.nodeRadius,
            selectedLogo: this.selectedLogo
        };
    }

    async saveData() {
        const data = this._buildSaveData();
        if (this.graphFile) {
            await graphStorage.saveGraph(this.graphFile, data);
        } else {
            localStorage.setItem('graphData', JSON.stringify(data));
        }
    }

    saveDataBackground() {
        this.saveData().catch(e => console.error('Save failed:', e));
    }

    async saveToFolder() {
        let dir = await graphStorage.getDirectory();
        if (!dir) {
            const granted = await graphStorage.requestPermission();
            if (!granted) {
                try {
                    await graphStorage.chooseDirectory();
                } catch (e) {
                    if (e.name !== 'AbortError') alert('Please choose a folder first.');
                    return;
                }
            }
            dir = await graphStorage.getDirectory();
            if (!dir) return;
        }

        const defaultName = this.graphFile ? this.graphFile.replace(/\.json$/i, '') : 'my-graph';
        const name = prompt('Save as:', defaultName);
        if (!name || !name.trim()) return;
        const safeName = name.trim().replace(/[<>:"/\\|?*]/g, '_');
        const filename = `${safeName}.json`;

        try {
            await graphStorage.saveGraph(filename, this._buildSaveData());
            window.location.href = `graph.html?graph=${encodeURIComponent(filename)}`;
        } catch (e) {
            alert('Failed to save: ' + e.message);
        }
    }

    _pushHistory() {
        this._undoStack.push(this._buildSaveData());
        if (this._undoStack.length > 50) this._undoStack.shift();
        this._redoStack = [];
    }

    _restoreState(state) {
        this.nodes = state.nodes.map(n => {
            const node = new Node(n.id, n.name, n.type, n.color, n.x, n.y);
            node.comments = Array.isArray(n.comments) ? n.comments : [];
            node.tags = Array.isArray(n.tags) ? n.tags : [];
            return node;
        });
        this.links = state.links.map(l => {
            const link = new Link(l.id, l.sourceId, l.targetId, l.name, l.type, l.color);
            link.comments = Array.isArray(l.comments) ? l.comments : [];
            return link;
        });
        this.nextNodeId = state.nextNodeId;
        this.nextLinkId = state.nextLinkId;
        this.globalTags = Array.isArray(state.globalTags) ? [...state.globalTags] :
            [...new Set(this.nodes.flatMap(n => n.tags || []))].sort();
        this.nodeRadius = state.nodeRadius || 30;
        for (const node of this.nodes) node.radius = this.nodeRadius;
        this.selectedLogo = state.selectedLogo !== undefined ? state.selectedLogo : 'default';
        this._invalidateAnalysis();
        this.selectedNode = null;
        this.selectedLink = null;
        this.selectedNodes.clear();
        this.updateSelectedInfo();
        this.updateCommentButtonVisibility();
        this.updateTagsUI();
        this._syncNodeSizeUI();
        this._syncLogoUI();
        this.updateStats();
        this.saveDataBackground();
    }

    undo() {
        if (!this._undoStack.length) return;
        this._redoStack.push(this._buildSaveData());
        this._restoreState(this._undoStack.pop());
    }

    redo() {
        if (!this._redoStack.length) return;
        this._undoStack.push(this._buildSaveData());
        this._restoreState(this._redoStack.pop());
    }

    resetForces() {
        for (const node of this.nodes) {
            node.ax = 0;
            node.ay = 0;
        }
    }

    applyCenterForce() {
        for (const node of this.nodes) {
            if (node === this.draggingNode) continue;

            const dx = -node.x;
            const dy = -node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
                node.ax += (dx / distance) * this.centerForce;
                node.ay += (dy / distance) * this.centerForce;
            }
        }
    }

    applyRepulsionForce() {
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const nodeA = this.nodes[i];
                const nodeB = this.nodes[j];

                if (nodeA === this.draggingNode || nodeB === this.draggingNode) continue;

                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const distSq = dx * dx + dy * dy;
                const dist = Math.sqrt(distSq);

                if (dist < 0.5) {
                    const angle = ((i * 127 + j * 311) % 628) / 100;
                    const force = this.repulsionForce;
                    nodeA.ax -= Math.cos(angle) * force;
                    nodeA.ay -= Math.sin(angle) * force;
                    nodeB.ax += Math.cos(angle) * force;
                    nodeB.ay += Math.sin(angle) * force;
                } else {
                    const force = this.repulsionForce / (dist * dist);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    nodeA.ax -= fx;
                    nodeA.ay -= fy;
                    nodeB.ax += fx;
                    nodeB.ay += fy;
                }
            }
        }
    }

    applyLinkAttractionForce() {
        for (const link of this.links) {
            const sourceNode = this.nodes.find(n => n.id === link.sourceId);
            const targetNode = this.nodes.find(n => n.id === link.targetId);

            if (!sourceNode || !targetNode) continue;
            if (sourceNode === this.draggingNode || targetNode === this.draggingNode) continue;

            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                const displacement = dist - this.defaultLinkDistance;
                const force = this.linkAttractionForce * displacement;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                sourceNode.ax += fx;
                sourceNode.ay += fy;
                targetNode.ax -= fx;
                targetNode.ay -= fy;
            }
        }
    }

    updateNodePhysics() {
        for (const node of this.nodes) {
            if (node === this.draggingNode) continue;

            node.vx = (node.vx + node.ax) * this.damping;
            node.vy = (node.vy + node.ay) * this.damping;

            const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
            if (speed > this.maxVelocity) {
                node.vx = (node.vx / speed) * this.maxVelocity;
                node.vy = (node.vy / speed) * this.maxVelocity;
            }

            node.x += node.vx;
            node.y += node.vy;
        }
    }

    applyColorForce() {
        if (!this.showIndicatorRings) return;
        if (this.redNodeForce === 0 && this.greenNodeForce === 0) return;
        const hasOutgoing = new Set(this.links.map(l => l.sourceId));
        const hasIncoming = new Set(this.links.map(l => l.targetId));
        for (const node of this.nodes) {
            if (node === this.draggingNode) continue;
            const out = hasOutgoing.has(node.id);
            const inc = hasIncoming.has(node.id);
            if (out && !inc) node.ax -= this.redNodeForce;
            else if (!out && inc) node.ax += this.greenNodeForce;
        }
    }

    simulateForces() {
        this.resetForces();
        this.applyCenterForce();
        this.applyRepulsionForce();
        this.applyLinkAttractionForce();
        this.applyColorForce();
        this.updateNodePhysics();
    }

    _invalidateAnalysis() {
        this._graphVersion++;
        this._reachabilityResult = { forwardIds: new Set(), backwardIds: new Set(), sourceId: null };
    }

    _getLinkOffsets() {
        const GAP = 30;
        const pairMap = new Map(); // "minId:maxId" → { fwd: [], rev: [] }
        for (const link of this.links) {
            if (link.sourceId === link.targetId) continue;
            const minId = Math.min(link.sourceId, link.targetId);
            const maxId = Math.max(link.sourceId, link.targetId);
            const key = `${minId}:${maxId}`;
            if (!pairMap.has(key)) pairMap.set(key, { fwd: [], rev: [] });
            const entry = pairMap.get(key);
            if (link.sourceId === minId) entry.fwd.push(link);
            else entry.rev.push(link);
        }
        const offsetMap = new Map(); // linkId → curveOffset (world units)
        for (const { fwd, rev } of pairMap.values()) {
            const nFwd = fwd.length, nRev = rev.length;
            const fwdBase = nRev > 0 ? 45 : 0;
            const revBase = nFwd > 0 ? 45 : 0;
            for (let i = 0; i < nFwd; i++)
                offsetMap.set(fwd[i].id, fwdBase + (i - (nFwd - 1) / 2) * GAP);
            for (let i = 0; i < nRev; i++)
                offsetMap.set(rev[i].id, revBase + (i - (nRev - 1) / 2) * GAP);
        }
        return offsetMap;
    }

    draw() {
        const bgColor = this.getCanvasBackgroundColor();
        this.ctx.fillStyle = bgColor || '#f5f5f5';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.showGrid) this.drawGrid();

        const linkColor    = this.getLinkColor();
        const linkOffsets  = this._getLinkOffsets();

        // Recompute analysis overlays only when graph topology changed
        if (this.showCycles && this._cycleVersion !== this._graphVersion) {
            this._cycleResult  = this._computeCycles();
            this._cycleVersion = this._graphVersion;
        }
        if (this.showCriticalPath && this._criticalVersion !== this._graphVersion) {
            this._criticalResult  = this._computeCriticalPath();
            this._criticalVersion = this._graphVersion;
        }
        const { cycleNodeIds, cycleLinkIds } = this.showCycles
            ? this._cycleResult
            : { cycleNodeIds: null, cycleLinkIds: null };
        const { pathNodeIds, pathLinkIds } = this.showCriticalPath
            ? this._criticalResult
            : { pathNodeIds: null, pathLinkIds: null };

        // Reachability: recompute whenever selected node changes
        if (this.showReachability) {
            const srcId = this.selectedNode ? this.selectedNode.id : null;
            if (srcId !== this._reachabilityResult.sourceId) {
                this._reachabilityResult = srcId !== null
                    ? this._computeReachability(srcId)
                    : { forwardIds: new Set(), backwardIds: new Set(), sourceId: null };
            }
        }

        // Betweenness: recompute only when graph version changes
        if (this.showBetweenness && this._betweennessVersion !== this._graphVersion) {
            this._betweennessScores  = this._computeBetweenness();
            this._betweennessVersion = this._graphVersion;
        }

        // Tag filter — compute once per frame
        const tagFilterActive = this.activeTags.size > 0;
        const tagMatchIds = new Set();
        if (tagFilterActive) {
            for (const node of this.nodes) {
                if ((node.tags || []).some(t => this.activeTags.has(t))) tagMatchIds.add(node.id);
            }
        }

        // Draw link overlays first (glow behind the regular link lines)
        for (const link of this.links) {
            const src = this.nodes.find(n => n.id === link.sourceId);
            const tgt = this.nodes.find(n => n.id === link.targetId);
            if (!src || !tgt) continue;
            const curveOffset = linkOffsets.get(link.id) ?? 0;
            if (cycleLinkIds?.has(link.id))
                this._drawLinkOverlay(link, src, tgt, curveOffset, 'rgba(231, 76, 60, 0.55)');
            if (pathLinkIds?.has(link.id))
                this._drawLinkOverlay(link, src, tgt, curveOffset, 'rgba(243, 156, 18, 0.65)');
        }

        // Regular links
        for (const link of this.links) {
            const sourceNode = this.nodes.find(n => n.id === link.sourceId);
            const targetNode = this.nodes.find(n => n.id === link.targetId);
            if (sourceNode && targetNode) {
                const linkInTagFilter = !tagFilterActive ||
                    (tagMatchIds.has(link.sourceId) && tagMatchIds.has(link.targetId));
                this.ctx.globalAlpha = linkInTagFilter ? 1 : 0.1;
                const options = { curveOffset: linkOffsets.get(link.id) ?? 0, labelAbove: this.labelsAboveArrow };
                if (link === this.selectedLink) {
                    const ctx = this.ctx;
                    ctx.shadowColor = 'rgba(52, 152, 219, 0.5)';
                    ctx.shadowBlur = 10;
                    link.draw(ctx, sourceNode, targetNode, this.offsetX, this.offsetY, this.scale, linkColor, this.rotateLinkLabels, options);
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                } else {
                    link.draw(this.ctx, sourceNode, targetNode, this.offsetX, this.offsetY, this.scale, linkColor, this.rotateLinkLabels, options);
                }
                this.ctx.globalAlpha = 1;
            }
        }

        const hasOutgoing = new Set(this.links.map(l => l.sourceId));
        const hasIncoming = new Set(this.links.map(l => l.targetId));

        for (const node of this.nodes) {
            const screenX      = node.x * this.scale + this.offsetX;
            const screenY      = node.y * this.scale + this.offsetY;
            const scaledRadius = node.radius * this.scale;

            const matchesSearch = !this.searchTerm ||
                node.name.toLowerCase().includes(this.searchTerm) ||
                (node.type && node.type.toLowerCase().includes(this.searchTerm));

            const reachActive = this.showReachability && this._reachabilityResult.sourceId !== null;
            const inReach = !reachActive ||
                node.id === this._reachabilityResult.sourceId ||
                this._reachabilityResult.forwardIds.has(node.id) ||
                this._reachabilityResult.backwardIds.has(node.id);
            const inTagFilter = !tagFilterActive || tagMatchIds.has(node.id);
            this.ctx.globalAlpha = ((this.searchTerm && !matchesSearch) || !inReach || !inTagFilter) ? 0.12 : 1;

            if (this.showIndicatorRings) {
                const out = hasOutgoing.has(node.id);
                const inc = hasIncoming.has(node.id);
                let ringColor = null;
                if (!out && !inc)     ringColor = '#0d00ff';
                else if (out && !inc) ringColor = '#e74c3c';
                else if (!out && inc) ringColor = '#27ae60';
                if (ringColor) {
                    this.ctx.strokeStyle = ringColor;
                    this.ctx.lineWidth = 3;
                    this.ctx.beginPath();
                    this.ctx.arc(screenX, screenY, scaledRadius + 9, 0, Math.PI * 2);
                    this.ctx.stroke();
                }
            }

            if (node === this.selectedNode) {
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, scaledRadius + 4, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            if (this.selectedNodes.has(node.id)) {
                this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.9)';
                this.ctx.lineWidth = 3;
                this.ctx.setLineDash([5, 3]);
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, scaledRadius + 6, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }

            if (this.searchTerm && matchesSearch) {
                this.ctx.strokeStyle = '#f39c12';
                this.ctx.lineWidth = 3;
                this.ctx.setLineDash([6, 3]);
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, scaledRadius + 15, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }

            // Cycle ring (outermost overlay ring)
            if (cycleNodeIds?.has(node.id)) {
                this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.9)';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, scaledRadius + 20, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            // Critical path ring
            if (pathNodeIds?.has(node.id)) {
                this.ctx.strokeStyle = 'rgba(243, 156, 18, 0.9)';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, scaledRadius + (cycleNodeIds?.has(node.id) ? 25 : 20), 0, Math.PI * 2);
                this.ctx.stroke();
            }

            // Reachability rings: blue = downstream, orange = upstream
            if (reachActive) {
                const isFwd = this._reachabilityResult.forwardIds.has(node.id);
                const isBwd = this._reachabilityResult.backwardIds.has(node.id);
                if (isFwd) {
                    this.ctx.strokeStyle = 'rgba(41, 128, 185, 0.9)';
                    this.ctx.lineWidth = 3;
                    this.ctx.beginPath();
                    this.ctx.arc(screenX, screenY, scaledRadius + 26, 0, Math.PI * 2);
                    this.ctx.stroke();
                }
                if (isBwd) {
                    this.ctx.strokeStyle = 'rgba(230, 126, 34, 0.9)';
                    this.ctx.lineWidth = 3;
                    this.ctx.beginPath();
                    this.ctx.arc(screenX, screenY, scaledRadius + (isFwd ? 31 : 26), 0, Math.PI * 2);
                    this.ctx.stroke();
                }
            }

            // Betweenness centrality ring: purple, width+opacity scale with score
            if (this.showBetweenness && this._betweennessScores) {
                const score = this._betweennessScores.get(node.id) || 0;
                if (score > 0.02) {
                    this.ctx.strokeStyle = `rgba(155, 89, 182, ${(0.25 + 0.75 * score).toFixed(2)})`;
                    this.ctx.lineWidth = (2 + 6 * score) * this.scale;
                    this.ctx.beginPath();
                    this.ctx.arc(screenX, screenY, scaledRadius + 35, 0, Math.PI * 2);
                    this.ctx.stroke();
                }
            }

            node.draw(this.ctx, this.offsetX, this.offsetY, this.scale, this.showNodeIds);

            // Comment badge dot — shown on nodes that have notes
            if (node.comments && node.comments.length > 0) {
                const isFaded = (this.searchTerm && !matchesSearch) || !inReach || !inTagFilter;
                this.ctx.globalAlpha = isFaded ? 0.15 : 1;
                const dotR = Math.max(4, scaledRadius * 0.22);
                const dotX = screenX + scaledRadius * 0.72;
                const dotY = screenY - scaledRadius * 0.72;
                this.ctx.fillStyle = '#3498db';
                this.ctx.beginPath();
                this.ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.strokeStyle = bgColor || '#f5f5f5';
                this.ctx.lineWidth = 1.5;
                this.ctx.stroke();
            }

            this.ctx.globalAlpha = 1;
        }

        this.drawZoomInfo();
        this.drawRubberBand();
    }

    drawGrid() {
        const gridSize = 50;
        const startX = Math.floor(-this.offsetX / this.scale / gridSize) * gridSize;
        const startY = Math.floor(-this.offsetY / this.scale / gridSize) * gridSize;
        const endX = startX + Math.ceil(this.canvas.width / this.scale / gridSize) * gridSize;
        const endY = startY + Math.ceil(this.canvas.height / this.scale / gridSize) * gridSize;

        const gridColor = this.getGridColor();
        this.ctx.strokeStyle = gridColor || '#e0e0e0';
        this.ctx.lineWidth = 0.5;

        for (let x = startX; x <= endX; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.scale + this.offsetX, startY * this.scale + this.offsetY);
            this.ctx.lineTo(x * this.scale + this.offsetX, endY * this.scale + this.offsetY);
            this.ctx.stroke();
        }

        for (let y = startY; y <= endY; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX * this.scale + this.offsetX, y * this.scale + this.offsetY);
            this.ctx.lineTo(endX * this.scale + this.offsetX, y * this.scale + this.offsetY);
            this.ctx.stroke();
        }
    }

    drawZoomInfo() {
        const textColor = this.getTextColor();
        this.ctx.fillStyle = textColor || '#2c3e50';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(`Zoom: ${(this.scale * 100).toFixed(0)}%`, 10, this.canvas.height - 10);
    }

    animate() {
        this.simulateForces();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }

    openCommentModal(element, type) {
        const modal = document.getElementById('commentModal');
        const title = document.getElementById('commentModalTitle');
        const newCommentInput = document.getElementById('newCommentInput');

        if (type === 'node') {
            title.textContent = `Comments for Node: ${element.name} (#${element.id})`;
        } else {
            title.textContent = `Comments for Link: #${element.sourceId} → #${element.targetId}`;
        }

        this.currentCommentElement = element;
        this.currentCommentType = type;

        this.refreshCommentsList();

        newCommentInput.value = '';
        modal.style.display = 'block';
    }

    closeCommentModal() {
        const modal = document.getElementById('commentModal');
        modal.style.display = 'none';
        this.currentCommentElement = null;
        this.currentCommentType = null;
    }

    refreshCommentsList() {
        const comments = document.getElementById('commentsList');
        comments.innerHTML = '';

        if (!this.currentCommentElement || !this.currentCommentElement.comments) {
            return;
        }

        if (this.currentCommentElement.comments.length === 0) {
            comments.innerHTML = '<p style="color: #999; font-style: italic;">No comments yet. Add one below!</p>';
            return;
        }

        this.currentCommentElement.comments.forEach((comment, index) => {
            const commentDiv = document.createElement('div');
            commentDiv.className = 'comment-item';
            commentDiv.innerHTML = `
                <div class="comment-header">
                    <strong>${comment.text}</strong>
                    ${!this.viewerMode ? `<div class="comment-actions"><button class="comment-delete-btn" onclick="editor.deleteComment(${index})">Delete</button></div>` : ''}
                </div>
                <small class="comment-timestamp">${comment.timestamp}</small>
            `;
            comments.appendChild(commentDiv);
        });
    }

    addComment() {
        const newCommentInput = document.getElementById('newCommentInput');
        const text = newCommentInput.value.trim();

        if (!text) {
            alert('Please enter a comment');
            return;
        }

        const now = new Date();
        const timestamp = now.toLocaleString();

        if (!this.currentCommentElement.comments) {
            this.currentCommentElement.comments = [];
        }

        this.currentCommentElement.comments.push({ text, timestamp });

        newCommentInput.value = '';
        this.refreshCommentsList();
        this.saveDataBackground();
    }

    deleteComment(index) {
        if (this.currentCommentElement.comments) {
            this.currentCommentElement.comments.splice(index, 1);
            this.refreshCommentsList();
            this.saveDataBackground();
        }
    }

    updateCommentButtonVisibility() {
        const commentBtn = document.getElementById('commentBtn');
        const show = (this.selectedNode || this.selectedLink) && this.selectedNodes.size === 0;
        commentBtn.style.display = show ? 'block' : 'none';
    }

    openCommentWindowFromButton() {
        if (this.selectedNode) {
            this.openCommentModal(this.selectedNode, 'node');
        } else if (this.selectedLink) {
            this.openCommentModal(this.selectedLink, 'link');
        }
    }

    _drawLinkOverlay(link, src, tgt, curveOffset, color) {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 6 * this.scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        if (src.id === tgt.id) {
            const cx  = src.x * this.scale + this.offsetX;
            const cy  = src.y * this.scale + this.offsetY;
            const r   = src.radius * this.scale;
            const ext = r * 2.8;
            const base = -Math.PI / 2, sp = 0.4;
            ctx.moveTo(cx + Math.cos(base + sp) * r, cy + Math.sin(base + sp) * r);
            ctx.bezierCurveTo(
                cx + Math.cos(base + sp) * (r + ext), cy + Math.sin(base + sp) * (r + ext),
                cx + Math.cos(base - sp) * (r + ext), cy + Math.sin(base - sp) * (r + ext),
                cx + Math.cos(base - sp) * r,         cy + Math.sin(base - sp) * r
            );
        } else {
            const sx0   = src.x * this.scale + this.offsetX;
            const sy0   = src.y * this.scale + this.offsetY;
            const ex0   = tgt.x * this.scale + this.offsetX;
            const ey0   = tgt.y * this.scale + this.offsetY;
            const angle = Math.atan2(ey0 - sy0, ex0 - sx0);
            if (curveOffset !== 0) {
                const d   = Link.CURVE_DELTA;
                const sx  = sx0 + Math.cos(angle + d) * src.radius * this.scale;
                const sy  = sy0 + Math.sin(angle + d) * src.radius * this.scale;
                const ex  = ex0 + Math.cos(angle + Math.PI - d) * tgt.radius * this.scale;
                const ey  = ey0 + Math.sin(angle + Math.PI - d) * tgt.radius * this.scale;
                const cpX = (sx + ex) / 2 + (-Math.sin(angle)) * curveOffset * this.scale;
                const cpY = (sy + ey) / 2 + Math.cos(angle) * curveOffset * this.scale;
                ctx.moveTo(sx, sy);
                ctx.quadraticCurveTo(cpX, cpY, ex, ey);
            } else {
                const sx = sx0 + Math.cos(angle) * src.radius * this.scale;
                const sy = sy0 + Math.sin(angle) * src.radius * this.scale;
                const ex = ex0 - Math.cos(angle) * tgt.radius * this.scale;
                const ey = ey0 - Math.sin(angle) * tgt.radius * this.scale;
                ctx.moveTo(sx, sy);
                ctx.lineTo(ex, ey);
            }
        }

        ctx.stroke();
        ctx.restore();
    }

    _computeReachability(sourceId) {
        const n = this.nodes.length;
        const idToIdx = new Map(this.nodes.map((nd, i) => [nd.id, i]));
        const adj  = Array.from({ length: n }, () => []);
        const radj = Array.from({ length: n }, () => []);

        for (const link of this.links) {
            if (link.sourceId === link.targetId) continue;
            const si = idToIdx.get(link.sourceId);
            const ti = idToIdx.get(link.targetId);
            if (si !== undefined && ti !== undefined) {
                adj[si].push(ti);
                radj[ti].push(si);
            }
        }

        const bfs = (startIdx, graph) => {
            const visited = new Set([startIdx]);
            const queue = [startIdx]; let head = 0;
            while (head < queue.length) {
                const v = queue[head++];
                for (const w of graph[v]) {
                    if (!visited.has(w)) { visited.add(w); queue.push(w); }
                }
            }
            visited.delete(startIdx);
            return visited;
        };

        const si = idToIdx.get(sourceId);
        if (si === undefined) return { forwardIds: new Set(), backwardIds: new Set(), sourceId };

        const fwdIdxs = bfs(si, adj);
        const bwdIdxs = bfs(si, radj);
        return {
            forwardIds:  new Set([...fwdIdxs].map(i => this.nodes[i].id)),
            backwardIds: new Set([...bwdIdxs].map(i => this.nodes[i].id)),
            sourceId
        };
    }

    _computeBetweenness() {
        const n = this.nodes.length;
        const scores = new Float64Array(n);
        if (n < 2) return new Map(this.nodes.map(nd => [nd.id, 0]));

        const idToIdx = new Map(this.nodes.map((nd, i) => [nd.id, i]));
        const adj = Array.from({ length: n }, () => []);
        for (const link of this.links) {
            if (link.sourceId === link.targetId) continue;
            const si = idToIdx.get(link.sourceId);
            const ti = idToIdx.get(link.targetId);
            if (si !== undefined && ti !== undefined) adj[si].push(ti);
        }

        // algorithm (directed, unweighted)
        for (let s = 0; s < n; s++) {
            const stack = [];
            const pred  = Array.from({ length: n }, () => []);
            const sigma = new Float64Array(n); sigma[s] = 1;
            const d     = new Int32Array(n).fill(-1); d[s] = 0;
            const queue = [s]; let head = 0;

            while (head < queue.length) {
                const v = queue[head++];
                stack.push(v);
                for (const w of adj[v]) {
                    if (d[w] < 0) { d[w] = d[v] + 1; queue.push(w); }
                    if (d[w] === d[v] + 1) { sigma[w] += sigma[v]; pred[w].push(v); }
                }
            }

            const delta = new Float64Array(n);
            while (stack.length > 0) {
                const w = stack.pop();
                for (const v of pred[w]) {
                    delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
                }
                if (w !== s) scores[w] += delta[w];
            }
        }

        const max = Math.max(...scores, 1e-9);
        const result = new Map();
        for (let i = 0; i < n; i++) result.set(this.nodes[i].id, scores[i] / max);
        return result;
    }

    _computeCycles() {
        const n = this.nodes.length;
        const cycleNodeIds = new Set();
        const cycleLinkIds = new Set();
        if (n === 0) return { cycleNodeIds, cycleLinkIds };

        const idToIdx = new Map(this.nodes.map((nd, i) => [nd.id, i]));
        const adj     = Array.from({ length: n }, () => []);

        for (const link of this.links) {
            if (link.sourceId === link.targetId) {
                cycleNodeIds.add(link.sourceId);
                cycleLinkIds.add(link.id);
                continue;
            }
            const si = idToIdx.get(link.sourceId);
            const ti = idToIdx.get(link.targetId);
            if (si !== undefined && ti !== undefined) adj[si].push(ti);
        }

        // SCC (iterative to avoid stack overflow on deep graphs)
        const idxArr  = new Int32Array(n).fill(-1);
        const low     = new Int32Array(n);
        const onStack = new Uint8Array(n);
        const sccOf   = new Int32Array(n).fill(-1);
        const sccSize = [];
        const stk     = [];
        let counter   = 0, sccCount = 0;

        for (let start = 0; start < n; start++) {
            if (idxArr[start] !== -1) continue;
            const callStack = [{ v: start, wi: 0 }];
            idxArr[start] = low[start] = counter++;
            stk.push(start); onStack[start] = 1;

            while (callStack.length > 0) {
                const frame = callStack[callStack.length - 1];
                const { v } = frame;
                if (frame.wi < adj[v].length) {
                    const w = adj[v][frame.wi++];
                    if (idxArr[w] === -1) {
                        idxArr[w] = low[w] = counter++;
                        stk.push(w); onStack[w] = 1;
                        callStack.push({ v: w, wi: 0 });
                    } else if (onStack[w]) {
                        low[v] = Math.min(low[v], idxArr[w]);
                    }
                } else {
                    callStack.pop();
                    if (callStack.length > 0) {
                        const parent = callStack[callStack.length - 1].v;
                        low[parent] = Math.min(low[parent], low[v]);
                    }
                    if (low[v] === idxArr[v]) {
                        const id = sccCount++; let sz = 0, w;
                        do { w = stk.pop(); onStack[w] = 0; sccOf[w] = id; sz++; } while (w !== v);
                        sccSize.push(sz);
                    }
                }
            }
        }

        for (let i = 0; i < n; i++) {
            if (sccSize[sccOf[i]] > 1) cycleNodeIds.add(this.nodes[i].id);
        }
        for (const link of this.links) {
            if (link.sourceId === link.targetId) continue;
            const si = idToIdx.get(link.sourceId);
            const ti = idToIdx.get(link.targetId);
            if (si !== undefined && ti !== undefined &&
                sccOf[si] === sccOf[ti] && sccSize[sccOf[si]] > 1) {
                cycleLinkIds.add(link.id);
            }
        }
        return { cycleNodeIds, cycleLinkIds };
    }

    _computeCriticalPath() {
        const pathNodeIds = new Set();
        const pathLinkIds = new Set();
        const n = this.nodes.length;
        if (n === 0) return { pathNodeIds, pathLinkIds };

        const idToIdx = new Map(this.nodes.map((nd, i) => [nd.id, i]));
        const adj     = Array.from({ length: n }, () => []);
        const inDeg   = new Int32Array(n);

        for (const link of this.links) {
            if (link.sourceId === link.targetId) continue;
            const si = idToIdx.get(link.sourceId);
            const ti = idToIdx.get(link.targetId);
            if (si !== undefined && ti !== undefined) {
                adj[si].push({ to: ti, linkId: link.id });
                inDeg[ti]++;
            }
        }

        // topological sort (cycle nodes naturally excluded — never reach inDeg 0)
        const queue    = [];
        const dist     = new Int32Array(n);
        const prevNode = new Int32Array(n).fill(-1);
        const prevLink = new Array(n).fill(null);
        for (let i = 0; i < n; i++) { if (inDeg[i] === 0) queue.push(i); }

        let head = 0;
        const topoOrder = [];
        while (head < queue.length) {
            const v = queue[head++];
            topoOrder.push(v);
            for (const { to, linkId } of adj[v]) {
                if (dist[v] + 1 > dist[to]) {
                    dist[to] = dist[v] + 1;
                    prevNode[to] = v;
                    prevLink[to] = linkId;
                }
                if (--inDeg[to] === 0) queue.push(to);
            }
        }

        // Sink = node with longest distance in topo order
        let maxDist = 0, sink = -1;
        for (const v of topoOrder) {
            if (dist[v] > maxDist) { maxDist = dist[v]; sink = v; }
        }
        if (sink === -1 || maxDist === 0) return { pathNodeIds, pathLinkIds };

        // Backtrack from sink to source - collect ordered sequence
        const pathSeq = [];
        let cur = sink;
        while (cur !== -1) { pathSeq.push(cur); cur = prevNode[cur]; }
        pathSeq.reverse();

        for (const v of pathSeq) pathNodeIds.add(this.nodes[v].id);

        // Build step map: idx → next idx in critical path
        const pathStep = new Map();
        for (let i = 0; i < pathSeq.length - 1; i++) pathStep.set(pathSeq[i], pathSeq[i + 1]);

        // Mark ALL parallel links between consecutive critical-path nodes
        for (const link of this.links) {
            if (link.sourceId === link.targetId) continue;
            const si = idToIdx.get(link.sourceId);
            const ti = idToIdx.get(link.targetId);
            if (si !== undefined && ti !== undefined && pathStep.get(si) === ti)
                pathLinkIds.add(link.id);
        }
        return { pathNodeIds, pathLinkIds };
    }

    drawRubberBand() {
        if (!this.rubberBand) return;
        const { startX, startY, endX, endY } = this.rubberBand;
        const sx = startX * this.scale + this.offsetX;
        const sy = startY * this.scale + this.offsetY;
        const ex = endX * this.scale + this.offsetX;
        const ey = endY * this.scale + this.offsetY;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.8)';
        this.ctx.fillStyle = 'rgba(52, 152, 219, 0.08)';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([4, 3]);
        this.ctx.strokeRect(sx, sy, ex - sx, ey - sy);
        this.ctx.fillRect(sx, sy, ex - sx, ey - sy);
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    exportSVG() {
        if (this.nodes.length === 0) { alert('No nodes to export.'); return; }

        const R = 30;
        const padding = 70;
        const xs = this.nodes.map(n => n.x);
        const ys = this.nodes.map(n => n.y);
        const minX = Math.min(...xs) - R - padding;
        const minY = Math.min(...ys) - R - padding;
        const maxX = Math.max(...xs) + R + padding;
        const maxY = Math.max(...ys) + R + padding;
        const W = maxX - minX;
        const H = maxY - minY;

        const esc = s => this._escapeXml(String(s));
        const linkColor = '#555555';

        // Bidirectional detection for SVG
        const svgBidi = new Set();
        for (const link of this.links) {
            if (link.sourceId !== link.targetId &&
                this.links.some(l => l.sourceId === link.targetId && l.targetId === link.sourceId)) {
                svgBidi.add(link.id);
            }
        }

        let linksSVG = '';
        for (const link of this.links) {
            const src = this.nodes.find(n => n.id === link.sourceId);
            const tgt = this.nodes.find(n => n.id === link.targetId);
            if (!src || !tgt) continue;

            if (src.id === tgt.id) {
                // Self-loop cubic bezier
                const ext  = R * 2.8;
                const base = -Math.PI / 2;
                const sp   = 0.4;
                const sx   = (src.x + Math.cos(base + sp) * R).toFixed(1);
                const sy   = (src.y + Math.sin(base + sp) * R).toFixed(1);
                const ex   = (src.x + Math.cos(base - sp) * R).toFixed(1);
                const ey   = (src.y + Math.sin(base - sp) * R).toFixed(1);
                const cp1x = (src.x + Math.cos(base + sp) * (R + ext)).toFixed(1);
                const cp1y = (src.y + Math.sin(base + sp) * (R + ext)).toFixed(1);
                const cp2x = (src.x + Math.cos(base - sp) * (R + ext)).toFixed(1);
                const cp2y = (src.y + Math.sin(base - sp) * (R + ext)).toFixed(1);
                linksSVG += `  <path d="M ${sx},${sy} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}" stroke="${linkColor}" stroke-width="2" fill="none" marker-end="url(#arrow)"/>\n`;
                if (link.name) {
                    const ext2 = R * 2.8;
                    const lx = src.x.toFixed(1);
                    const ly = (src.y - R - ext2 * 0.55 - 8).toFixed(1);
                    linksSVG += `  <text x="${lx}" y="${ly}" text-anchor="middle" font-size="10" font-family="Arial,sans-serif" fill="#333">${esc(link.name)}</text>\n`;
                }
            } else if (svgBidi.has(link.id)) {
                // Curved quadratic bezier with 2.5° endpoint offset
                const dx    = tgt.x - src.x;
                const dy    = tgt.y - src.y;
                const angle = Math.atan2(dy, dx);
                const d     = Math.PI / 20;
                const x1    = (src.x + Math.cos(angle + d) * R).toFixed(1);
                const y1    = (src.y + Math.sin(angle + d) * R).toFixed(1);
                const x2    = (tgt.x + Math.cos(angle + Math.PI - d) * R).toFixed(1);
                const y2    = (tgt.y + Math.sin(angle + Math.PI - d) * R).toFixed(1);
                const cpX   = ((parseFloat(x1) + parseFloat(x2)) / 2 + (-Math.sin(angle)) * 45).toFixed(1);
                const cpY   = ((parseFloat(y1) + parseFloat(y2)) / 2 + Math.cos(angle) * 45).toFixed(1);
                linksSVG += `  <path d="M ${x1},${y1} Q ${cpX},${cpY} ${x2},${y2}" stroke="${linkColor}" stroke-width="2" fill="none" marker-end="url(#arrow)"/>\n`;
                if (link.name) {
                    const mx = (0.25 * parseFloat(x1) + 0.5 * parseFloat(cpX) + 0.25 * parseFloat(x2)).toFixed(1);
                    const my = (0.25 * parseFloat(y1) + 0.5 * parseFloat(cpY) + 0.25 * parseFloat(y2) - 8).toFixed(1);
                    linksSVG += `  <rect x="${(parseFloat(mx) - 32).toFixed(1)}" y="${(parseFloat(my) - 8).toFixed(1)}" width="64" height="14" fill="white" fill-opacity="0.85" rx="2"/>\n`;
                    linksSVG += `  <text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-family="Arial,sans-serif" fill="#333">${esc(link.name)}</text>\n`;
                }
            } else {
                // Straight line
                const dx   = tgt.x - src.x;
                const dy   = tgt.y - src.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const x1   = (src.x + (dx / dist) * R).toFixed(1);
                const y1   = (src.y + (dy / dist) * R).toFixed(1);
                const x2   = (tgt.x - (dx / dist) * (R + 10)).toFixed(1);
                const y2   = (tgt.y - (dy / dist) * (R + 10)).toFixed(1);
                linksSVG += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${linkColor}" stroke-width="2" marker-end="url(#arrow)"/>\n`;
                if (link.name) {
                    const mx = ((src.x + tgt.x) / 2).toFixed(1);
                    const my = ((src.y + tgt.y) / 2 - 10).toFixed(1);
                    linksSVG += `  <rect x="${(parseFloat(mx) - 32).toFixed(1)}" y="${(parseFloat(my) - 8).toFixed(1)}" width="64" height="14" fill="white" fill-opacity="0.85" rx="2"/>\n`;
                    linksSVG += `  <text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-family="Arial,sans-serif" fill="#333">${esc(link.name)}</text>\n`;
                }
            }
        }

        let nodesSVG = '';
        for (const node of this.nodes) {
            const cx = node.x.toFixed(1);
            const cy = node.y.toFixed(1);
            const color = node.color || '#3498db';
            nodesSVG += `  <circle cx="${cx}" cy="${cy}" r="${R}" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1.5"/>\n`;
            const lines = [];
            if (this.showNodeIds) lines.push({ text: `#${node.id}`, size: 11, weight: 'bold' });
            lines.push({ text: node.name, size: 11, weight: 'normal' });
            if (node.type) lines.push({ text: node.type, size: 9, weight: 'normal' });
            const lh = 13;
            const startY = node.y - ((lines.length - 1) * lh) / 2;
            for (let i = 0; i < lines.length; i++) {
                const { text, size, weight } = lines[i];
                const ty = (startY + i * lh).toFixed(1);
                nodesSVG += `  <text x="${cx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" font-size="${size}" font-weight="${weight}" font-family="Arial,sans-serif" fill="white">${esc(text)}</text>\n`;
            }
        }

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${W.toFixed(1)} ${H.toFixed(1)}" width="${Math.round(W)}" height="${Math.round(H)}">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="${linkColor}"/>
    </marker>
  </defs>
  <rect x="${minX.toFixed(1)}" y="${minY.toFixed(1)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="#f5f5f5"/>
${linksSVG}${nodesSVG}</svg>`;

        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (this.graphFile ? this.graphFile.replace(/\.json$/i, '') : 'graph') + '.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    _escapeXml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ===== VIEWER MODE =====

    setupViewerMode() {
        const savedMode = localStorage.getItem('viewerMode');
        if (savedMode === 'true') {
            this.viewerMode = true;
            document.body.classList.add('viewer-mode');
            const btn = document.getElementById('viewerModeBtn');
            if (btn) { btn.textContent = '✏️ Developer Mode'; btn.classList.add('active'); }
        }

        const savedSidebar = localStorage.getItem('viewerSidebarHidden');
        if (savedSidebar === 'true') {
            this.viewerSidebarHidden = true;
            document.body.classList.add('viewer-sidebar-hidden');
            requestAnimationFrame(() => this.resizeCanvas());
        }

        this._syncSidebarTabBtn();

        document.getElementById('viewerModeBtn')
            ?.addEventListener('click', () => this.toggleViewerMode());

        document.getElementById('viewerInfoClose')
            ?.addEventListener('click', () => {
                this.hideViewerInfo();
                this.selectedNode = null;
                this.selectedLink = null;
                this.selectedNodes.clear();
                this.updateSelectedInfo();
                this.updateCommentButtonVisibility();
            });

        document.getElementById('viewerSidebarReveal')
            ?.addEventListener('click', () => this.toggleViewerSidebar());
    }

    _syncSidebarTabBtn() {
        const tab = document.getElementById('viewerSidebarReveal');
        if (!tab) return;
        // ›  when sidebar is visible (click to collapse), ‹ when hidden (click to expand)
        tab.textContent = this.viewerSidebarHidden ? '‹' : '›';
        tab.title = this.viewerSidebarHidden ? 'Show display panel' : 'Hide display panel';
    }

    toggleViewerMode() {
        this.viewerMode = !this.viewerMode;
        const btn = document.getElementById('viewerModeBtn');

        if (this.viewerMode) {
            document.body.classList.add('viewer-mode');
            if (btn) { btn.textContent = '✏️ Developer Mode'; btn.classList.add('active'); }
        } else {
            document.body.classList.remove('viewer-mode');
            if (btn) { btn.textContent = '👁️ Viewer Mode'; btn.classList.remove('active'); }
            this.hideViewerInfo();
        }

        localStorage.setItem('viewerMode', this.viewerMode);
        this.updateCommentButtonVisibility();
        // Canvas may change size if viewerSidebarHidden was active
        if (this.viewerSidebarHidden) requestAnimationFrame(() => this.resizeCanvas());
        if (this.viewerMode && this.selectedNode) this.showViewerInfo(this.selectedNode, 'node');
        else if (this.viewerMode && this.selectedLink) this.showViewerInfo(this.selectedLink, 'link');
    }

    toggleViewerSidebar() {
        this.viewerSidebarHidden = !this.viewerSidebarHidden;
        if (this.viewerSidebarHidden) {
            document.body.classList.add('viewer-sidebar-hidden');
        } else {
            document.body.classList.remove('viewer-sidebar-hidden');
        }
        localStorage.setItem('viewerSidebarHidden', this.viewerSidebarHidden);
        this._syncSidebarTabBtn();
        requestAnimationFrame(() => this.resizeCanvas());
    }

    showViewerInfo(element, type) {
        const panel = document.getElementById('viewerNodeInfo');
        const titleEl = document.getElementById('viewerInfoTitle');
        const content = document.getElementById('viewerInfoContent');
        if (!panel || !titleEl || !content) return;

        let html = '';

        if (type === 'node') {
            titleEl.textContent = element.name;

            const metaParts = [];
            if (element.type) metaParts.push(this._esc(element.type));
            metaParts.push(`#${element.id}`);
            html += `<div class="viewer-meta">`;
            if (element.color) {
                html += `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${element.color};border:1px solid rgba(0,0,0,0.12);flex-shrink:0;"></span>`;
            }
            html += metaParts.join('<span style="color:var(--viewer-accent);padding:0 3px;">·</span>') + `</div>`;

            if (element.definition) {
                html += `<div class="viewer-section-title">Definition</div>`;
                html += `<div class="viewer-definition">${this._esc(element.definition)}</div>`;
            }

            html += `<div class="viewer-section-title">Notes</div>`;
            const comments = element.comments || [];
            if (comments.length === 0) {
                html += `<p class="viewer-no-notes">No notes for this node.</p>`;
            } else {
                comments.forEach(c => {
                    html += `<div class="viewer-comment-item">${this._esc(c.text)}`;
                    if (c.timestamp) html += `<div class="viewer-comment-date">${this._esc(c.timestamp)}</div>`;
                    html += `</div>`;
                });
            }

            const outgoing = this.links.filter(l => l.sourceId === element.id);
            const incoming = this.links.filter(l => l.targetId === element.id);
            if (outgoing.length > 0 || incoming.length > 0) {
                html += `<div class="viewer-section-title">Connections</div><div class="viewer-connections">`;
                outgoing.forEach(l => {
                    const t = this.nodes.find(n => n.id === l.targetId);
                    const name = t ? this._esc(t.name) : `#${l.targetId}`;
                    const label = l.name ? ` <span style="color:var(--viewer-accent);font-size:0.85em;">(${this._esc(l.name)})</span>` : '';
                    html += `<div class="viewer-connection-row"><span class="viewer-arrow">→</span><span>${name}${label}</span></div>`;
                });
                incoming.forEach(l => {
                    const s = this.nodes.find(n => n.id === l.sourceId);
                    const name = s ? this._esc(s.name) : `#${l.sourceId}`;
                    const label = l.name ? ` <span style="color:var(--viewer-accent);font-size:0.85em;">(${this._esc(l.name)})</span>` : '';
                    html += `<div class="viewer-connection-row"><span class="viewer-arrow">←</span><span>${name}${label}</span></div>`;
                });
                html += `</div>`;
            }

        } else if (type === 'link') {
            const src = this.nodes.find(n => n.id === element.sourceId);
            const tgt = this.nodes.find(n => n.id === element.targetId);
            const srcName = src ? src.name : `#${element.sourceId}`;
            const tgtName = tgt ? tgt.name : `#${element.targetId}`;
            titleEl.textContent = element.name || `${srcName} → ${tgtName}`;

            html += `<div class="viewer-meta">${this._esc(srcName)} → ${this._esc(tgtName)}</div>`;
            if (element.type) html += `<div class="viewer-meta">Type: ${this._esc(element.type)}</div>`;

            html += `<div class="viewer-section-title">Notes</div>`;
            const comments = element.comments || [];
            if (comments.length === 0) {
                html += `<p class="viewer-no-notes">No notes for this link.</p>`;
            } else {
                comments.forEach(c => {
                    html += `<div class="viewer-comment-item">${this._esc(c.text)}`;
                    if (c.timestamp) html += `<div class="viewer-comment-date">${this._esc(c.timestamp)}</div>`;
                    html += `</div>`;
                });
            }
        }

        content.innerHTML = html;
        panel.classList.add('visible');
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    hideViewerInfo() {
        document.getElementById('viewerNodeInfo')?.classList.remove('visible');
    }

    // ===== TAGS =====

    getAllTags() {
        return [...this.globalTags].sort();
    }

    setupTagsPanel() {
        document.getElementById('addTagBtn')?.addEventListener('click', () => {
            const input = document.getElementById('newTagInput');
            const tag = input?.value.trim();
            if (!tag) return;
            if (!this.globalTags.includes(tag)) {
                this._pushHistory();
                this.globalTags.push(tag);
                this.saveDataBackground();
                this.updateTagsUI();
            }
            if (input) input.value = '';
        });

        document.getElementById('newTagInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('addTagBtn')?.click();
        });
    }

    updateTagsUI() {
        this._updateDevTagsPanel();
        this._updateViewerTagsPanel();
    }

    _updateDevTagsPanel() {
        const listEl = document.getElementById('globalTagsList');
        if (!listEl) return;

        const allTags = this.getAllTags();
        if (allTags.length === 0) {
            listEl.innerHTML = '<span class="tags-empty">No tags defined yet.</span>';
        } else {
            listEl.innerHTML = allTags.map(tag =>
                `<span class="tag-chip" data-tag="${this._esc(tag)}">${this._esc(tag)}<button class="tag-chip-rename" data-tag="${this._esc(tag)}" title="Rename tag">✎</button><button class="tag-chip-del" data-tag="${this._esc(tag)}" title="Delete tag">×</button></span>`
            ).join('');

            listEl.querySelectorAll('.tag-chip-rename').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tag = btn.dataset.tag;
                    const chip = btn.closest('.tag-chip');
                    chip.classList.add('editing');
                    chip.innerHTML = `<input class="tag-rename-input" value="${this._esc(tag)}"><button class="tag-rename-save" title="Save">✓</button><button class="tag-rename-cancel" title="Cancel">✕</button>`;
                    const input = chip.querySelector('.tag-rename-input');
                    input.focus();
                    input.select();
                    const save = () => {
                        const newName = input.value.trim();
                        if (newName && newName !== tag) this._renameTag(tag, newName);
                        else this.updateTagsUI();
                    };
                    chip.querySelector('.tag-rename-save').addEventListener('click', save);
                    chip.querySelector('.tag-rename-cancel').addEventListener('click', () => this.updateTagsUI());
                    input.addEventListener('keydown', e => {
                        if (e.key === 'Enter') save();
                        if (e.key === 'Escape') this.updateTagsUI();
                    });
                });
            });

            listEl.querySelectorAll('.tag-chip-del').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tag = btn.dataset.tag;
                    this._pushHistory();
                    this.globalTags = this.globalTags.filter(t => t !== tag);
                    for (const node of this.nodes) {
                        node.tags = (node.tags || []).filter(t => t !== tag);
                    }
                    this.activeTags.delete(tag);
                    this.saveDataBackground();
                    this.updateTagsUI();
                });
            });
        }

        const nodeSection = document.getElementById('nodeTagsSection');
        if (!nodeSection) return;

        if (!this.selectedNode) {
            nodeSection.style.display = 'none';
            return;
        }

        nodeSection.style.display = '';
        const nodeTagsList = document.getElementById('nodeTagsList');
        if (!nodeTagsList) return;

        if (allTags.length === 0) {
            nodeTagsList.innerHTML = '<span class="tags-empty">Create tags above first.</span>';
        } else {
            const nodeTags = this.selectedNode.tags || [];
            nodeTagsList.innerHTML = allTags.map(tag => {
                const checked = nodeTags.includes(tag);
                return `<label class="tag-assign-row"><input type="checkbox" class="tag-assign-cb" data-tag="${this._esc(tag)}"${checked ? ' checked' : ''}><span>${this._esc(tag)}</span></label>`;
            }).join('');

            nodeTagsList.querySelectorAll('.tag-assign-cb').forEach(cb => {
                cb.addEventListener('change', () => {
                    if (!this.selectedNode) return;
                    const tag = cb.dataset.tag;
                    this._pushHistory();
                    if (cb.checked) {
                        if (!this.selectedNode.tags.includes(tag)) this.selectedNode.tags.push(tag);
                    } else {
                        this.selectedNode.tags = this.selectedNode.tags.filter(t => t !== tag);
                    }
                    this.saveDataBackground();
                    this._updateViewerTagsPanel();
                });
            });
        }
    }

    _updateViewerTagsPanel() {
        const container = document.getElementById('viewerTagFilters');
        if (!container) return;

        const allTags = this.getAllTags();
        if (allTags.length === 0) {
            container.innerHTML = '<span class="viewer-tags-empty">No tags defined.</span>';
            return;
        }

        container.innerHTML = allTags.map(tag =>
            `<button class="viewer-tag-btn${this.activeTags.has(tag) ? ' active' : ''}" data-tag="${this._esc(tag)}">${this._esc(tag)}</button>`
        ).join('');

        container.querySelectorAll('.viewer-tag-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tag = btn.dataset.tag;
                if (this.activeTags.has(tag)) {
                    this.activeTags.delete(tag);
                    btn.classList.remove('active');
                } else {
                    this.activeTags.add(tag);
                    btn.classList.add('active');
                }
            });
        });
    }

    _syncNodeSizeUI() {
        const slider = document.getElementById('nodeSizeSlider');
        const val    = document.getElementById('nodeSizeVal');
        if (slider) slider.value = this.nodeRadius;
        if (val)    val.textContent = this.nodeRadius;
    }

    _getStoredLogos() {
        try { return JSON.parse(localStorage.getItem('uploadedLogos') || '[]'); }
        catch { return []; }
    }

    _buildLogoSelector() {
        const list     = document.getElementById('logoSelectorList');
        const showLogoCb = document.getElementById('showLogo');
        const container  = document.getElementById('logoSelectorContainer');
        if (!list) return;

        // Sync checkbox + container visibility with current state
        const logoActive = this.selectedLogo !== null;
        if (showLogoCb) showLogoCb.checked = logoActive;
        if (container)  container.style.display = logoActive ? '' : 'none';

        // Build radio list (Default + uploaded logos)
        const logos = this._getStoredLogos();
        list.innerHTML = '';
        const allLogos = [
            { id: 'default', name: 'Default', src: 'images/Kurant_Logo_3000pxw.png' },
            ...logos.map(l => ({ id: l.id, name: l.name, src: l.dataUrl }))
        ];

        for (const logo of allLogos) {
            const label = document.createElement('label');
            label.className = 'logo-option';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'logoSelect';
            radio.value = logo.id;
            radio.checked = this.selectedLogo === logo.id;
            radio.addEventListener('change', () => {
                this.selectedLogo = logo.id;
                this._applyLogoSelection();
                this.saveDataBackground();
            });
            label.appendChild(radio);

            const img = document.createElement('img');
            img.src = logo.src;
            img.className = 'logo-option-thumb';
            img.alt = logo.name;
            label.appendChild(img);

            const span = document.createElement('span');
            span.className = 'logo-option-name';
            span.textContent = logo.name;
            label.appendChild(span);

            list.appendChild(label);
        }

        this._applyLogoSelection();
    }

    _applyLogoSelection() {
        const graphLogo    = document.getElementById('graphLogo');
        const graphLogoImg = document.getElementById('graphLogoImg');
        if (!graphLogo || !graphLogoImg) return;

        if (!this.selectedLogo) {
            graphLogo.style.display = 'none';
            return;
        }
        graphLogo.style.display = '';
        if (this.selectedLogo === 'default') {
            graphLogoImg.src = 'images/Kurant_Logo_3000pxw.png';
        } else {
            const logo = this._getStoredLogos().find(l => l.id === this.selectedLogo);
            if (logo) {
                graphLogoImg.src = logo.dataUrl;
            } else {
                this.selectedLogo = 'default';
                graphLogoImg.src = 'images/Kurant_Logo_3000pxw.png';
            }
        }
    }

    _syncLogoUI() {
        this._buildLogoSelector();
    }

    _renameTag(oldName, newName) {
        if (!newName || oldName === newName) { this.updateTagsUI(); return; }
        if (this.globalTags.includes(newName)) { this.updateTagsUI(); return; }
        this._pushHistory();
        const idx = this.globalTags.indexOf(oldName);
        if (idx !== -1) this.globalTags[idx] = newName;
        for (const node of this.nodes) {
            const i = (node.tags || []).indexOf(oldName);
            if (i !== -1) node.tags[i] = newName;
        }
        if (this.activeTags.has(oldName)) {
            this.activeTags.delete(oldName);
            this.activeTags.add(newName);
        }
        this.saveDataBackground();
        this.updateTagsUI();
    }

    _esc(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

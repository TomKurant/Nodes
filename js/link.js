class Link {
    constructor(id, sourceId, targetId, name, type, color) {
        this.id = id;
        this.sourceId = sourceId;
        this.targetId = targetId;
        this.name = name;
        this.type = type;
        this.color = color;
        this.comments = [];
    }

    static get CURVE_DELTA() { return Math.PI / 20; }

    // options: { curveOffset: number (world units, 0 = straight), labelAbove: bool }
    draw(ctx, sourceNode, targetNode, offsetX, offsetY, scale, color, rotateLabels, options = {}) {
        const { curveOffset = 0, labelAbove = false } = options;

        if (sourceNode.id === targetNode.id) {
            this._drawSelfLoop(ctx, sourceNode, offsetX, offsetY, scale, color);
            return;
        }

        const startX = sourceNode.x * scale + offsetX;
        const startY = sourceNode.y * scale + offsetY;
        const endX   = targetNode.x * scale + offsetX;
        const endY   = targetNode.y * scale + offsetY;
        const angle  = Math.atan2(endY - startY, endX - startX);

        let adjSX, adjSY, adjEX, adjEY;
        if (curveOffset !== 0) {
            const d = Link.CURVE_DELTA;
            adjSX = startX + Math.cos(angle + d) * sourceNode.radius * scale;
            adjSY = startY + Math.sin(angle + d) * sourceNode.radius * scale;
            adjEX = endX   + Math.cos(angle + Math.PI - d) * targetNode.radius * scale;
            adjEY = endY   + Math.sin(angle + Math.PI - d) * targetNode.radius * scale;
        } else {
            adjSX = startX + Math.cos(angle) * sourceNode.radius * scale;
            adjSY = startY + Math.sin(angle) * sourceNode.radius * scale;
            adjEX = endX   - Math.cos(angle) * targetNode.radius * scale;
            adjEY = endY   - Math.sin(angle) * targetNode.radius * scale;
        }

        if (curveOffset !== 0) {
            this._drawCurved(ctx, adjSX, adjSY, adjEX, adjEY, angle, scale, color, rotateLabels, labelAbove, curveOffset);
        } else {
            this._drawStraight(ctx, adjSX, adjSY, adjEX, adjEY, angle, scale, color, rotateLabels, labelAbove);
        }
    }

    _drawStraight(ctx, sx, sy, ex, ey, angle, scale, color, rotateLabels, labelAbove) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        this._drawArrowHead(ctx, ex, ey, angle, scale, color);
        this._drawLabel(ctx, (sx + ex) / 2, (sy + ey) / 2, angle, scale, rotateLabels, labelAbove);
    }

    _drawCurved(ctx, sx, sy, ex, ey, angle, scale, color, rotateLabels, labelAbove, perpOffset = 45) {
        const offset = perpOffset * scale;
        const cpX = (sx + ex) / 2 + (-Math.sin(angle)) * offset;
        const cpY = (sy + ey) / 2 + Math.cos(angle) * offset;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cpX, cpY, ex, ey);
        ctx.stroke();

        const arrowAngle = Math.atan2(ey - cpY, ex - cpX);
        this._drawArrowHead(ctx, ex, ey, arrowAngle, scale, color);

        // Quadratic bezier midpoint and tangent at t=0.5
        const mx = 0.25 * sx + 0.5 * cpX + 0.25 * ex;
        const my = 0.25 * sy + 0.5 * cpY + 0.25 * ey;
        const tx = 0.5 * (cpX - sx) + 0.5 * (ex - cpX);
        const ty = 0.5 * (cpY - sy) + 0.5 * (ey - cpY);
        this._drawLabel(ctx, mx, my, Math.atan2(ty, tx), scale, rotateLabels, labelAbove);
    }

    _drawSelfLoop(ctx, node, offsetX, offsetY, scale, color) {
        const cx  = node.x * scale + offsetX;
        const cy  = node.y * scale + offsetY;
        const r   = node.radius * scale;
        const ext = r * 2.8;

        // Two attachment points near the top of the node
        const base = -Math.PI / 2;
        const spread = 0.4;
        const a1 = base + spread;
        const a2 = base - spread;

        const sx   = cx + Math.cos(a1) * r;
        const sy   = cy + Math.sin(a1) * r;
        const ex   = cx + Math.cos(a2) * r;
        const ey   = cy + Math.sin(a2) * r;
        const cp1x = cx + Math.cos(a1) * (r + ext);
        const cp1y = cy + Math.sin(a1) * (r + ext);
        const cp2x = cx + Math.cos(a2) * (r + ext);
        const cp2y = cy + Math.sin(a2) * (r + ext);

        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
        ctx.stroke();

        const arrowAngle = Math.atan2(ey - cp2y, ex - cp2x);
        this._drawArrowHead(ctx, ex, ey, arrowAngle, scale, color);

        if (this.name) {
            const labelX = cx;
            const labelY = cy - r - ext * 0.55;
            ctx.font = `${10 * scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const tw  = ctx.measureText(this.name).width;
            const pad = 4 * scale;
            ctx.fillStyle = 'rgb(255, 255, 255)';
            ctx.fillRect(labelX - tw / 2 - pad, labelY - 8 * scale, tw + pad * 2, 16 * scale);
            ctx.fillStyle = '#000000';
            ctx.fillText(this.name, labelX, labelY);
        }
    }

    _drawArrowHead(ctx, x, y, angle, scale, color) {
        const size = 15 * scale;
        const bx   = x - Math.cos(angle) * size;
        const by   = y - Math.sin(angle) * size;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(bx - Math.sin(angle) * size / 2, by + Math.cos(angle) * size / 2);
        ctx.lineTo(bx + Math.sin(angle) * size / 2, by - Math.cos(angle) * size / 2);
        ctx.closePath();
        ctx.fill();
    }

    _drawLabel(ctx, midX, midY, angle, scale, rotateLabels, labelAbove) {
        if (!this.name) return;
        ctx.font = `${10 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const vOff = labelAbove ? -14 * scale : 0;

        if (rotateLabels) {
            let textAngle = angle;
            if (Math.cos(textAngle) < 0) textAngle += Math.PI;
            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(textAngle);
            const tw  = ctx.measureText(this.name).width;
            const pad = 4 * scale;
            ctx.fillStyle = 'rgb(255, 255, 255)';
            ctx.fillRect(-tw / 2 - pad, -8 * scale + vOff, tw + pad * 2, 16 * scale);
            ctx.fillStyle = '#000000';
            ctx.fillText(this.name, 0, vOff);
            ctx.restore();
        } else {
            ctx.fillStyle = 'rgb(255, 255, 255)';
            ctx.fillRect(midX - 30 * scale, midY - 10 * scale + vOff, 60 * scale, 16 * scale);
            ctx.fillStyle = '#000000';
            ctx.fillText(this.name, midX, midY + vOff);
        }
    }

    hitTest(x, y, sourceNode, targetNode, curveOffset = 0) {
        if (sourceNode.id === targetNode.id) {
            const r   = sourceNode.radius;
            const ext = r * 2.8;
            const lcy = sourceNode.y - r - ext * 0.55;
            const lr  = ext * 0.55;
            return Math.sqrt((x - sourceNode.x) ** 2 + (y - lcy) ** 2) <= lr;
        }

        const dx    = targetNode.x - sourceNode.x;
        const dy    = targetNode.y - sourceNode.y;
        const dist  = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return false;
        const angle = Math.atan2(dy, dx);

        if (curveOffset !== 0) {
            const d   = Link.CURVE_DELTA;
            const R   = sourceNode.radius;
            const sx  = sourceNode.x + Math.cos(angle + d) * R;
            const sy  = sourceNode.y + Math.sin(angle + d) * R;
            const ex  = targetNode.x + Math.cos(angle + Math.PI - d) * R;
            const ey  = targetNode.y + Math.sin(angle + Math.PI - d) * R;
            const cpX = (sx + ex) / 2 + (-Math.sin(angle)) * curveOffset;
            const cpY = (sy + ey) / 2 + Math.cos(angle) * curveOffset;
            const N   = 24;
            for (let i = 0; i <= N; i++) {
                const t  = i / N;
                const bx = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cpX + t * t * ex;
                const by = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cpY + t * t * ey;
                if ((x - bx) ** 2 + (y - by) ** 2 <= 100) return true; // threshold 10
            }
            return false;
        }

        const px = x - sourceNode.x;
        const py = y - sourceNode.y;
        const t  = Math.max(0, Math.min(1, (px * dx + py * dy) / (dist * dist)));
        return Math.sqrt((x - (sourceNode.x + t * dx)) ** 2 + (y - (sourceNode.y + t * dy)) ** 2) <= 10;
    }
}

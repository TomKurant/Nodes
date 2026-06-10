class Node {
    constructor(id, name, type, color, x = 0, y = 0) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.color = color;
        this.x = x;
        this.y = y;
        this.radius = 30;
        this.vx = 0;
        this.vy = 0;
        this.ax = 0;
        this.ay = 0;
        this.definition = '';
        this.comments = [];
        this.tags = [];
    }

    draw(ctx, offsetX, offsetY, scale, showId = true) {
        const screenX = this.x * scale + offsetX;
        const screenY = this.y * scale + offsetY;
        const scaledRadius = this.radius * scale;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.beginPath();
        ctx.arc(screenX + 2, screenY + 2, scaledRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();

        const outlineAlpha = this._outlineAlpha(this.color);
        const drawText = (text, x, y) => {
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.lineWidth = 2.5 * scale;
            ctx.strokeStyle = `rgba(0,0,0,${outlineAlpha.toFixed(2)})`;
            ctx.strokeText(text, x, y);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, x, y);
        };

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const ts = this.radius / 30; // text scale proportional to node radius

        if (showId) {
            ctx.font = `bold ${14 * ts * scale}px Arial`;
            drawText(`#${this.id}`, screenX, screenY - 8 * ts * scale);

            ctx.font = `${11 * ts * scale}px Arial`;
            drawText(this.name, screenX, screenY + 5 * ts * scale);

            if (this.type) {
                ctx.font = `${9 * ts * scale}px Arial`;
                drawText(this.type, screenX, screenY + 15 * ts * scale);
            }
        } else {
            ctx.font = `${11 * ts * scale}px Arial`;
            drawText(this.name, screenX, screenY);

            if (this.type) {
                ctx.font = `${9 * ts * scale}px Arial`;
                drawText(this.type, screenX, screenY + 12 * ts * scale);
            }
        }
    }

    _luminance(hex) {
        let h = (hex || '#3498db').replace('#', '');
        if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
        const lin = s => { const v = parseInt(s, 16) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * lin(h.slice(0,2)) + 0.7152 * lin(h.slice(2,4)) + 0.0722 * lin(h.slice(4,6));
    }

    _outlineAlpha(hex) {
        try {
            return Math.min(0.85, this._luminance(hex) * 2.8);
        } catch { return 0.5; }
    }

    contains(x, y) {
        const dist = Math.sqrt((this.x - x) ** 2 + (this.y - y) ** 2);
        return dist <= this.radius;
    }

    distanceTo(x, y) {
        return Math.sqrt((this.x - x) ** 2 + (this.y - y) ** 2);
    }
}

class GraphStorage {
    constructor() {
        this._dirHandle = null;
    }

    isSupported() {
        return 'showDirectoryPicker' in window;
    }

    async _openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('NodeGraphSystem', 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore('handles');
            req.onsuccess = e => resolve(e.target.result);
            req.onerror = e => reject(e.target.error);
        });
    }

    async _saveHandle(handle) {
        const db = await this._openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('handles', 'readwrite');
            tx.objectStore('handles').put(handle, 'dir');
            tx.oncomplete = () => resolve();
            tx.onerror = e => reject(e.target.error);
        });
    }

    async _loadHandle() {
        const db = await this._openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('handles', 'readonly');
            const req = tx.objectStore('handles').get('dir');
            req.onsuccess = e => resolve(e.target.result || null);
            req.onerror = e => reject(e.target.error);
        });
    }

    async chooseDirectory() {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await this._saveHandle(handle);
        this._dirHandle = handle;
        return handle;
    }

    async getDirectory() {
        if (this._dirHandle) return this._dirHandle;
        const handle = await this._loadHandle();
        if (!handle) return null;
        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
            this._dirHandle = handle;
            return handle;
        }
        return null;
    }

    // Must be called from a user gesture (button click)
    async requestPermission() {
        const handle = await this._loadHandle();
        if (!handle) return false;
        const perm = await handle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
            this._dirHandle = handle;
            return true;
        }
        return false;
    }

    async hasStoredHandle() {
        const handle = await this._loadHandle();
        return !!handle;
    }

    getDirectoryName() {
        return this._dirHandle ? this._dirHandle.name : null;
    }

    async listGraphs() {
        const dir = await this.getDirectory();
        if (!dir) return [];
        const graphs = [];
        for await (const [name, handle] of dir.entries()) {
            if (handle.kind === 'file' && name.endsWith('.json')) {
                const file = await handle.getFile();
                graphs.push({ name: name.slice(0, -5), filename: name, modified: file.lastModified });
            }
        }
        return graphs.sort((a, b) => b.modified - a.modified);
    }

    async createGraph(name) {
        const dir = await this.getDirectory();
        if (!dir) throw new Error('No directory selected');
        const filename = `${name}.json`;
        const fileHandle = await dir.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify({ nodes: [], links: [], nextNodeId: 0, nextLinkId: 0 }, null, 2));
        await writable.close();
        return filename;
    }

    async loadGraph(filename) {
        const dir = await this.getDirectory();
        if (!dir) throw new Error('No directory selected');
        const fileHandle = await dir.getFileHandle(filename);
        const file = await fileHandle.getFile();
        return JSON.parse(await file.text());
    }

    async saveGraph(filename, data) {
        const dir = await this.getDirectory();
        if (!dir) throw new Error('No directory selected');
        const fileHandle = await dir.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
    }

    async deleteGraph(filename) {
        const dir = await this.getDirectory();
        if (!dir) throw new Error('No directory selected');
        await dir.removeEntry(filename);
    }
}

const graphStorage = new GraphStorage();
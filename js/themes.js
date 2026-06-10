// Theme definitions
const themes = {
    light: {
        name: 'Light Mode',
        colors: {
            primary: '#3498db',
            secondary: '#2c3e50',
            success: '#27ae60',
            danger: '#e74c3c',
            bgColor: '#ecf0f1',
            panelBg: '#ffffff',
            textColor: '#2c3e50',
            borderColor: '#bdc3c7',
            shadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            canvasBg: '#ffffff',
            gridColor: '#8a8a8a',
            linkColor: '#696969'
        },
        fonts: {
            primary: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            heading: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }
    },
    dark: {
        name: 'Dark Mode',
        colors: {
            primary:     '#4db6e8',
            secondary:   '#1e2d45',
            success:     '#4caf7d',
            danger:      '#e05252',
            bgColor:     '#111827',
            panelBg:     '#1f2937',
            textColor:   '#d1d9e6',
            borderColor: '#2d3748',
            shadow:      '0 2px 12px rgba(0, 0, 0, 0.5)',
            canvasBg:    '#0d111a',
            gridColor:   '#f8f8f8',
            linkColor:   '#ffffff'
        },
        fonts: {
            primary: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            heading: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }
    },
    neon: {
        name: 'Neon',
        colors: {
            primary: '#00ffff',
            secondary: '#1a0033',
            success: '#00ff88',
            danger: '#ff0066',
            bgColor: '#0a001a',
            panelBg: '#1a0033',
            textColor: '#00ffff',
            borderColor: '#ff00ff',
            shadow: '0 0 30px rgba(0, 255, 255, 0.5), 0 0 60px rgba(255, 0, 255, 0.3)',
            canvasBg: '#101010',
            gridColor: '#ff00ff',
            linkColor: '#ffffff'
        },
        fonts: {
            primary: "'Courier New', 'Lucida Console', monospace",
            heading: "'Courier New', 'Lucida Console', monospace"
        }
    },
    pastel: {
        name: 'Pastel',
        colors: {
            primary: '#b090dc',
            secondary: '#e8b4cc',
            success: '#90c890',
            danger: '#e090a0',
            bgColor: '#f0ecff',
            panelBg: '#fdf8ff',
            textColor: '#50387a',
            borderColor: '#d0bef0',
            shadow: '0 2px 10px rgba(176, 144, 220, 0.2)',
            canvasBg: '#f5f0ff',
            gridColor: '#d4c0f0',
            linkColor: '#50387a'
        },
        fonts: {
            primary: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            heading: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }
    },
    forest: {
        name: 'Forest',
        colors: {
            primary: '#58a86a',
            secondary: '#183020',
            success: '#78c07a',
            danger: '#c05840',
            bgColor: '#18281a',
            panelBg: '#1f3421',
            textColor: '#c0e8b0',
            borderColor: '#2c4a2e',
            shadow: '0 2px 12px rgba(0, 0, 0, 0.55)',
            canvasBg: '#2c4331',
            gridColor: '#1ad330',
            linkColor: '#c4b073'
        },
        fonts: {
            primary: "'Georgia', 'Times New Roman', serif",
            heading: "'Georgia', 'Times New Roman', serif"
        }
    },
    editorial: {
        name: 'Editorial',
        colors: {
            primary: '#000000',
            secondary: '#181818',
            success: '#214f34',
            danger: '#711f1f',
            bgColor: '#f0f0f0',
            panelBg: '#ffffff',
            textColor: '#181818',
            borderColor: '#4b4b4b',
            shadow: '0 1px 6px rgba(0, 0, 0, 0.07)',
            canvasBg: '#f9f9f9',
            gridColor: '#171717',
            linkColor: '#181818'
        },
        fonts: {
            primary: "'Georgia', 'Palatino Linotype', 'Times New Roman', serif",
            heading: "'Georgia', 'Palatino Linotype', 'Times New Roman', serif"
        }
    },
    oldschool: {
        name: 'Old School',
        colors: {
            primary: '#c8a438',
            secondary: '#2c1a08',
            success: '#587840',
            danger: '#8a1818',
            bgColor: '#1a1008',
            panelBg: '#221408',
            textColor: '#e8d088',
            borderColor: '#4c2e10',
            shadow: '0 2px 16px rgba(0, 0, 0, 0.7)',
            canvasBg: '#120c04',
            gridColor: '#fdd682',
            linkColor: '#e8d088'
        },
        fonts: {
            primary: "'Georgia', 'Times New Roman', serif",
            heading: "'Georgia', 'Times New Roman', serif"
        }
    },
    ocean: {
        name: 'Ocean',
        colors: {
            primary: '#00b4d8',
            secondary: '#023e8a',
            success: '#2dc653',
            danger: '#e63946',
            bgColor: '#03045e',
            panelBg: '#0a1628',
            textColor: '#90e0ef',
            borderColor: '#0077b6',
            shadow: '0 2px 16px rgba(0, 100, 180, 0.4)',
            canvasBg: '#041b3c',
            gridColor: '#0089d3',
            linkColor: '#caf0f8'
        },
        fonts: {
            primary: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            heading: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }
    },
    crimson: {
        name: 'Crimson',
        colors: {
            primary: '#cc0000',
            secondary: '#0c0c0c',
            success: '#386838',
            danger: '#ff2020',
            bgColor: '#0d0d0d',
            panelBg: '#2c2c2c',
            textColor: '#ffffff',
            borderColor: '#ff0000',
            shadow: '0 2px 12px rgba(184, 0, 0, 0.25)',
            canvasBg: '#ffffff',
            gridColor: '#ff0000',
            linkColor: '#000000'
        },
        fonts: {
            primary: "'Arial', 'Helvetica Neue', sans-serif",
            heading: "'Arial', 'Helvetica Neue', sans-serif"
        }
    }
};

// Theme manager
class ThemeManager {
    constructor() {
        this.currentTheme = this.loadTheme() || 'light';
        this.applyTheme(this.currentTheme);
    }

    loadTheme() {
        return localStorage.getItem('selectedTheme');
    }

    saveTheme(themeName) {
        localStorage.setItem('selectedTheme', themeName);
    }

    applyTheme(themeName) {
        const theme = themes[themeName];
        if (!theme) {
            console.error(`Theme "${themeName}" not found`);
            return;
        }

        this.currentTheme = themeName;
        this.saveTheme(themeName);

        // Apply colors
        Object.keys(theme.colors).forEach(key => {
            document.documentElement.style.setProperty(
                `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`,
                theme.colors[key]
            );
        });

        // Apply fonts
        Object.keys(theme.fonts).forEach(key => {
            document.documentElement.style.setProperty(
                `--font-${key}`,
                theme.fonts[key]
            );
        });

        // Remove all theme classes and add the active one
        document.documentElement.classList.remove('light-theme', 'dark-theme', 'neon-theme', 'pastel-theme', 'forest-theme', 'editorial-theme', 'oldschool-theme', 'ocean-theme', 'crimson-theme');
        document.documentElement.classList.add(`${themeName}-theme`);

        // Update theme selector if it exists
        const selector = document.getElementById('themeSelector');
        if (selector) {
            selector.value = themeName;
        }

        // Dispatch custom event for other components to listen if needed
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: themeName } }));
    }

    getAvailableThemes() {
        return Object.keys(themes).map(key => ({
            id: key,
            name: themes[key].name
        }));
    }

    getCurrentTheme() {
        return this.currentTheme;
    }
}

// Initialize theme manager when DOM is ready
let themeManager;
document.addEventListener('DOMContentLoaded', () => {
    themeManager = new ThemeManager();

    // Setup theme selector listener if element exists
    const selector = document.getElementById('themeSelector');
    if (selector) {
        selector.addEventListener('change', (e) => {
            themeManager.applyTheme(e.target.value);
        });
    }
});

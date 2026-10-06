const fs = require('fs');
const path = require('path');
function searchDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            searchDirectory(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.mjs')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('fetch =')) {
                // we'll just check for fetch
                const match = content.match(/.*?fetch\s*=[^;]+/g);
                if (match) {
                     let found = match.some(m => m.includes('window') || m.includes('global') || m.includes('self') || m.includes('globalThis'));
                     if (found) console.log(fullPath);
                }
            }
        }
    }
}
searchDirectory('node_modules');

const fs = require('fs');
const path = require('path');
function searchDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (fullPath.includes('node_modules')) {
               if (fullPath.endsWith('undici') || fullPath.endsWith('node-fetch') || fullPath.endsWith('whatwg-fetch')) {
                  // search inside these
                  searchDirectory(fullPath);
               } else if (!fullPath.includes('@') && !fullPath.includes('/', dir.length+1) ) {
                  // shallow search
                  searchDirectory(fullPath);
               } else {
                   searchDirectory(fullPath);
               }
            } else {
               searchDirectory(fullPath);
            }
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.mjs') || fullPath.endsWith('.cjs')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('fetch =') || content.includes('fetch=')) {
                // look for overriding fetch on global or window
                if (content.includes('global.fetch =') || content.includes('window.fetch =') || content.includes('self.fetch =') || content.includes('globalThis.fetch =')) {
                     console.log("Found override in: ", fullPath);
                }
            }
        }
    }
}
searchDirectory('node_modules');

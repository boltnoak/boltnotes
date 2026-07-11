let BasePath;

let notes;
let games;
let fortnite;

const basePagePathLog = document.querySelector('base').href
    .replace(/.*(?=BoltNotes\/)/, 'Documentos/')
    .replace(/\/+$/, '')
    .replace('file:///', '')
    .replace(/\//g,' > ');

console.log(`Base da página: ${basePagePathLog}`);

const appStorage = {
    load: async (filePath) => {
        try {
            const fileHandle = await getFileHandle(filePath, { create: false });
            const file = await fileHandle.getFile();
            const content = await file.text();
            return JSON.parse(content);
        } catch (error) {
            return {};
        }
    },
    
    save: async ({ filePath, data }) => {
        try {
            const fileHandle = await getFileHandle(filePath, { create: true });
            const writable = await fileHandle.createWritable();
            
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
            return true;
        } catch (error) {
            console.error("Erro ao salvar o arquivo:", error);
            return false;
        }
    }
};
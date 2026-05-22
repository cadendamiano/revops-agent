// Browser stub for better-sqlite3. The real module is server-only.
// getDb() in lib/db/sqlite.ts is never called client-side, so this
// constructor is never invoked — it just needs to exist so the import succeeds.
function Database() {
  throw new Error('better-sqlite3 is not available in the browser');
}
module.exports = Database;
module.exports.default = Database;

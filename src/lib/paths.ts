// Utilitários de caminho independentes de SO — o servidor pareado pode
// rodar em Windows (`D:\dev\projeto`), Linux ou macOS (`/home/user/projeto`),
// e o app não sabe qual até perguntar. `path.*` do Node assume o SO de quem
// roda o *app*, não o do servidor, então não serve aqui — precisa de lógica
// própria que aceite os dois separadores.

const WINDOWS_DRIVE_ROOT = /^[a-zA-Z]:$/;

function stripTrailingSlashes(path: string): string {
  return path.replace(/[/\\]+$/, '');
}

export function basename(path: string): string {
  const normalized = stripTrailingSlashes(path);
  const lastSlash = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  const name = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  return name || normalized;
}

// Raiz de verdade: "/" no POSIX, "D:" ou "D:\" numa unidade Windows —
// não tem mais pra onde subir a partir daqui.
export function isRootPath(path: string): boolean {
  const normalized = stripTrailingSlashes(path);
  if (normalized === '') return true;
  return WINDOWS_DRIVE_ROOT.test(normalized);
}

// Diretório pai, cross-SO. Retorna `null` quando `path` já é uma raiz
// (não tem como subir mais). Preserva o separador nativo do próprio
// caminho recebido em vez de assumir um SO.
export function parentPath(path: string): string | null {
  if (isRootPath(path)) return null;
  const normalized = stripTrailingSlashes(path);
  const lastSlash = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (lastSlash < 0) return null;
  const parent = normalized.slice(0, lastSlash);
  if (parent === '') return '/';
  if (WINDOWS_DRIVE_ROOT.test(parent)) return `${parent}\\`;
  return parent;
}

// Compara dois caminhos ignorando barra vs contrabarra e maiúsculas —
// o desktop no Windows não é case-sensitive e pode reportar o mesmo
// projeto com separador diferente dependendo da rota que o resolveu.
export function normalizePathKey(path: string): string {
  return stripTrailingSlashes(path).replace(/\\/g, '/').toLowerCase();
}

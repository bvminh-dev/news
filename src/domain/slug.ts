/** Sinh slug kebab-case không dấu từ tên danh mục. */
const COMBINING = /[̀-ͯ]/g;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'muc';
}

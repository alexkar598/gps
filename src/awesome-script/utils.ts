export function gatherText(node: Node) {
  const text = new Array<string>();
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text.push(node.textContent);
    } else {
      for (const child of node.childNodes) {
        walk(child);
      }
    }
  }
  walk(node);
  return text.join(' ').trim();
}

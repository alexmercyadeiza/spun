export function upsertAppBlock(content, appName, port, domain) {
  const subdomain = `${appName}.${domain}`;
  const newBlock = `${subdomain} {\n    reverse_proxy localhost:${port}\n}`;

  const blockRegex = new RegExp(
    `${escapeRegex(subdomain)}\\s*\\{[^}]*\\}`,
    's'
  );

  if (blockRegex.test(content)) {
    return content.replace(blockRegex, newBlock);
  }

  return content.trimEnd() + '\n\n' + newBlock + '\n';
}

export function removeAppBlock(content, appName, domain) {
  const subdomain = `${appName}.${domain}`;
  const blockRegex = new RegExp(
    `\\n*${escapeRegex(subdomain)}\\s*\\{[^}]*\\}\\n?`,
    's'
  );
  return content.replace(blockRegex, '\n');
}

export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

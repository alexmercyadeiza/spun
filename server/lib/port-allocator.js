const PORT_START = 3001;

export function allocatePort(registry, appName) {
  if (registry.apps[appName]?.port) {
    return registry.apps[appName].port;
  }

  const usedPorts = Object.values(registry.apps).map((a) => a.port).filter(Boolean);
  let port = PORT_START;
  while (usedPorts.includes(port)) {
    port++;
  }
  return port;
}

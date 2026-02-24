const MAX_CONCURRENT = 2;
const MAX_QUEUED = 5;

let running = 0;
const pending = [];

export function queueLength() {
  return pending.length;
}

export function runningCount() {
  return running;
}

export function enqueue(fn) {
  return new Promise((resolve, reject) => {
    if (pending.length >= MAX_QUEUED) {
      reject(new Error('Build queue is full. Try again later.'));
      return;
    }

    const task = { fn, resolve, reject };
    pending.push(task);
    drain();
  });
}

function drain() {
  while (running < MAX_CONCURRENT && pending.length > 0) {
    const task = pending.shift();
    running++;
    task.fn()
      .then(task.resolve)
      .catch(task.reject)
      .finally(() => {
        running--;
        drain();
      });
  }
}

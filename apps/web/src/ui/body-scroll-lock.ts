type Lock = {
  owners: Set<symbol>
  original: { property: string; value: string; priority: string }[]
}

const locks = new WeakMap<HTMLElement, Lock>()

/** Overlapping dialogs may unmount in a different order than they mounted. */
export function lockBodyScroll(body = document.body) {
  let lock = locks.get(body)
  if (!lock) {
    lock = {
      owners: new Set(),
      original: ['overflow', 'overflow-x', 'overflow-y'].map((property) => ({
        property,
        value: body.style.getPropertyValue(property),
        priority: body.style.getPropertyPriority(property),
      })),
    }
    locks.set(body, lock)
    body.style.setProperty('overflow', 'hidden')
  }
  const owner = Symbol()
  lock.owners.add(owner)
  return () => {
    if (!lock.owners.delete(owner) || lock.owners.size) return
    body.style.removeProperty('overflow')
    for (const { property, value, priority } of lock.original) {
      if (value) body.style.setProperty(property, value, priority)
    }
    locks.delete(body)
  }
}

import { join } from 'node:path'

import { app, Menu, nativeImage, Tray } from 'electron'

/**
 * T.O.E.Z.'s presence on the machine: a menu bar icon, always resident, no Dock
 * icon and no windows. The Panel arrives in T6.
 */

/** Icons live outside the bundle; `__dirname` is `out/main` once built. */
const RESOURCES = join(__dirname, '../../resources')

let tray: Tray | undefined

function createTray(): Tray {
  const iconPath = join(RESOURCES, 'trayTemplate.png')
  const icon = nativeImage.createFromPath(iconPath)

  // An unreadable icon leaves an invisible menu bar item and no error at all,
  // so refuse to start rather than look like nothing happened.
  if (icon.isEmpty()) {
    throw new Error(`Menu bar icon missing or unreadable at ${iconPath}`)
  }
  icon.setTemplateImage(true)

  const created = new Tray(icon)
  created.setToolTip('T.O.E.Z.')
  created.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'ที่นี่ครับ เจ้านาย', enabled: false },
      { type: 'separator' },
      { role: 'quit', label: 'Quit T.O.E.Z.' },
    ]),
  )
  return created
}

void app.whenReady().then(
  () => {
    app.dock?.hide()
    tray = createTray()
    console.log('[T.O.E.Z.] menu bar presence ready')
  },
  (error: unknown) => {
    console.error('[T.O.E.Z.] failed to start', error)
    app.exit(1)
  },
)

app.on('before-quit', () => {
  tray?.destroy()
  tray = undefined
})

// Deliberately no `window-all-closed` handler: T.O.E.Z. owns no windows yet,
// and quitting stays the menu bar's decision.

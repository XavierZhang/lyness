/** Minimal marker that selects the desktop custom-protocol API carrier. */

import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('lynDesktop', { protocolVersion: 1 })

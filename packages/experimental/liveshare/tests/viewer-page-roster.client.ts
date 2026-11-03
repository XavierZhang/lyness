/**
 * Test-only client roster of the assembled viewer page.
 *
 * A served viewer page is the owner's own Web shell with the owner's client plugins; this roster is the
 * subset the viewer page specs need: the wire plugin, the Gateway, remote access, the Session/Workspace controllers,
 * the menu service, presentation plugins, and the Liveshare `./client` face, which mounts the viewer surfaces when the
 * carrier names a share. Every row is the package's own `/client` face registered as a module-table
 * factory. It must be imported only after {@link prepareViewerRemoteFaces} answered the generated
 * `/remote` faces these plugins import.
 *
 * @module @lyness/lyn-experimental-liveshare/tests/viewer-page-roster
 */

import * as apiGateway from '@lyness/lyn-api-gateway/client'
import * as apiRemoteAccess from '@lyness/lyn-api-remote-access/client'
import * as apiRemotes from '@lyness/lyn-api-remotes/client'
import * as apiSessionController from '@lyness/lyn-api-session-controller/client'
import * as apiWorkspaceController from '@lyness/lyn-api-workspace-controller/client'
import * as clientConnection from '@lyness/lyn-client-connection/client'
import * as clientFileUpload from '@lyness/lyn-client-file-upload/client'
import * as clientLocale from '@lyness/lyn-client-locale/client'
import * as clientModules from '@lyness/lyn-client-modules/client'
import * as clientResources from '@lyness/lyn-client-resources/client'
import * as clientShortcuts from '@lyness/lyn-client-shortcuts/client'
import * as uiAttachment from '@lyness/lyn-client-ui-attachment/client'
import * as uiChat from '@lyness/lyn-client-ui-chat/client'
import * as uiContextMenu from '@lyness/lyn-client-ui-context-menu/client'
import * as uiConversation from '@lyness/lyn-client-ui-conversation/client'
import * as uiDeliverables from '@lyness/lyn-client-ui-deliverables/client'
import * as uiFileDrag from '@lyness/lyn-client-ui-file-drag/client'
import * as uiLayout from '@lyness/lyn-client-ui-layout/client'
import * as uiRenderer from '@lyness/lyn-client-ui-renderer/client'
import * as uiSession from '@lyness/lyn-client-ui-session/client'
import * as uiSettings from '@lyness/lyn-client-ui-settings/client'
import * as uiSidebar from '@lyness/lyn-client-ui-sidebar/client'
import * as uiSidebarRight from '@lyness/lyn-client-ui-sidebar-right/client'
import * as uiTheme from '@lyness/lyn-client-ui-theme/client'
import * as uiTool from '@lyness/lyn-client-ui-tool/client'
import * as uiTrajectory from '@lyness/lyn-client-ui-trajectory/client'
import * as uiWorkspace from '@lyness/lyn-client-ui-workspace/client'
import * as typertRegistry from '@lyness/lyn-typert-registry/client'
import * as liveshare from '../src/client/index.ts'

/** One module-table row: the entry id the Loader creates, and that plugin's client exports. */
export interface ViewerPageRosterRow {
  readonly id: string
  readonly exports: Readonly<Record<string, unknown>>
}

/** Entry id of the module-system bootstrap whose exports the facade hands to the module system. */
export const VIEWER_PAGE_BOOTSTRAP_ID = '@lyness/lyn-client-modules'

/** The viewer page roster; Cordis composes these entries by service injection, so order is irrelevant. */
export const VIEWER_PAGE_ROSTER: readonly ViewerPageRosterRow[] = [
  { id: '@lyness/lyn-typert-registry', exports: typertRegistry },
  { id: '@lyness/lyn-experimental-liveshare', exports: liveshare },
  { id: VIEWER_PAGE_BOOTSTRAP_ID, exports: clientModules },
  { id: '@lyness/lyn-client-connection', exports: clientConnection },
  { id: '@lyness/lyn-api-gateway', exports: apiGateway },
  { id: '@lyness/lyn-api-remote-access', exports: apiRemoteAccess },
  { id: '@lyness/lyn-api-remotes', exports: apiRemotes },
  { id: '@lyness/lyn-api-session-controller', exports: apiSessionController },
  { id: '@lyness/lyn-api-workspace-controller', exports: apiWorkspaceController },
  { id: '@lyness/lyn-client-file-upload', exports: clientFileUpload },
  { id: '@lyness/lyn-client-locale', exports: clientLocale },
  { id: '@lyness/lyn-client-resources', exports: clientResources },
  { id: '@lyness/lyn-client-shortcuts', exports: clientShortcuts },
  { id: '@lyness/lyn-client-ui-renderer', exports: uiRenderer },
  { id: '@lyness/lyn-client-ui-theme', exports: uiTheme },
  { id: '@lyness/lyn-client-ui-settings', exports: uiSettings },
  { id: '@lyness/lyn-client-ui-layout', exports: uiLayout },
  { id: '@lyness/lyn-client-ui-session', exports: uiSession },
  { id: '@lyness/lyn-client-ui-sidebar', exports: uiSidebar },
  { id: '@lyness/lyn-client-ui-conversation', exports: uiConversation },
  { id: '@lyness/lyn-client-ui-chat', exports: uiChat },
  { id: '@lyness/lyn-client-ui-context-menu', exports: uiContextMenu },
  { id: '@lyness/lyn-client-ui-tool', exports: uiTool },
  { id: '@lyness/lyn-client-ui-attachment', exports: uiAttachment },
  { id: '@lyness/lyn-client-ui-file-drag', exports: uiFileDrag },
  { id: '@lyness/lyn-client-ui-sidebar-right', exports: uiSidebarRight },
  { id: '@lyness/lyn-client-ui-trajectory', exports: uiTrajectory },
  { id: '@lyness/lyn-client-ui-deliverables', exports: uiDeliverables },
  { id: '@lyness/lyn-client-ui-workspace', exports: uiWorkspace },
]

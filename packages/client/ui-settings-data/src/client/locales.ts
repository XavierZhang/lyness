/**
 * Copy for the data section: a person's own conversations, the copy they can
 * take, and the deletion they can ask for.
 *
 * @module @lyness/lyn-client-ui-settings-data/client/locales
 */

/** English copy; the key set every locale answers. */
export const en = {
  nav: 'Data',
  title: 'Your conversations',
  intro: 'Every conversation you can open. Take a copy of one, or delete it.',
  none: 'You have no conversations yet.',
  lastActive: 'Last active {at}',
  export: 'Download',
  noExport: 'This deployment offers no download; a conversation can still be deleted.',
  delete: 'Delete',
  deleteConfirm: 'Delete for good',
  deleteCancel: 'Keep it',
  deleting: 'Deleting…',
  deleteWarning: 'Deleting is permanent. Nothing here or anywhere else brings a conversation back, so download it first if you want a copy.',
  removed: 'Deleted. {count} stored session(s) went, including any work it delegated.',
  refused: 'That deletion was refused: {reason}',
  keeps: 'Deleting removes the conversation and everything it delegated. Files you uploaded are stored by their contents and may belong to another conversation too, so their bytes stay.',
}

/** The data namespace key union. */
export type DataKey = keyof typeof en

/** zh copy, checked complete against the English key set. */
export const zh: Record<DataKey, string> = {
  nav: '数据',
  title: '你的对话',
  intro: '你能打开的每一段对话。你可以把它下载一份，也可以删掉它。',
  none: '你还没有对话。',
  lastActive: '最后活动于 {at}',
  export: '下载',
  noExport: '这个部署不提供下载；对话仍然可以删除。',
  delete: '删除',
  deleteConfirm: '确认永久删除',
  deleteCancel: '留着',
  deleting: '正在删除…',
  deleteWarning: '删除不可撤销。这里和别处都没有任何办法把一段对话找回来，想留一份就先下载。',
  removed: '已删除。共移除 {count} 份会话记录，包含它派发出去的工作。',
  refused: '这次删除被拒绝：{reason}',
  keeps: '删除会移除这段对话以及它派发出去的一切。你上传的文件按内容存放，可能同时属于别的对话，因此文件本身的字节会保留。',
}

/** ja copy, checked complete against the English key set. */
export const ja: Record<DataKey, string> = {
  nav: 'データ',
  title: 'あなたの会話',
  intro: 'あなたが開ける会話のすべて。コピーを取ることも、削除することもできます。',
  none: 'まだ会話がありません。',
  lastActive: '最終更新 {at}',
  export: 'ダウンロード',
  noExport: 'このデプロイはダウンロードを提供しません。会話の削除は引き続きできます。',
  delete: '削除',
  deleteConfirm: '完全に削除する',
  deleteCancel: '残す',
  deleting: '削除中…',
  deleteWarning: '削除は取り消せません。ここでも他のどこでも会話を元に戻す方法はないので、コピーが必要なら先にダウンロードしてください。',
  removed: '削除しました。委任された作業を含め、{count} 件の保存済みセッションが消えました。',
  refused: 'この削除は拒否されました：{reason}',
  keeps: '削除はこの会話と、それが委任したすべてを取り除きます。アップロードしたファイルは内容で保存され、別の会話にも属している可能性があるため、そのバイト列は残ります。',
}

/** es copy, checked complete against the English key set. */
export const es: Record<DataKey, string> = {
  nav: 'Datos',
  title: 'Tus conversaciones',
  intro: 'Todas las conversaciones que puedes abrir. Descarga una copia o elimínala.',
  none: 'Todavía no tienes conversaciones.',
  lastActive: 'Última actividad: {at}',
  export: 'Descargar',
  noExport: 'Este despliegue no ofrece descarga; una conversación aún se puede eliminar.',
  delete: 'Eliminar',
  deleteConfirm: 'Eliminar definitivamente',
  deleteCancel: 'Conservarla',
  deleting: 'Eliminando…',
  deleteWarning: 'La eliminación es permanente. Nada aquí ni en ningún otro sitio recupera una conversación, así que descárgala antes si quieres una copia.',
  removed: 'Eliminada. Se fueron {count} sesiones almacenadas, incluido el trabajo que delegó.',
  refused: 'Esa eliminación fue rechazada: {reason}',
  keeps: 'La eliminación quita la conversación y todo lo que delegó. Los archivos que subiste se guardan por su contenido y pueden pertenecer también a otra conversación, así que sus bytes se mantienen.',
}

/** fr copy, checked complete against the English key set. */
export const fr: Record<DataKey, string> = {
  nav: 'Données',
  title: 'Vos conversations',
  intro: 'Toutes les conversations que vous pouvez ouvrir. Téléchargez-en une copie ou supprimez-la.',
  none: 'Vous n’avez pas encore de conversation.',
  lastActive: 'Dernière activité : {at}',
  export: 'Télécharger',
  noExport: 'Ce déploiement ne propose pas de téléchargement ; une conversation reste supprimable.',
  delete: 'Supprimer',
  deleteConfirm: 'Supprimer définitivement',
  deleteCancel: 'La garder',
  deleting: 'Suppression…',
  deleteWarning: 'La suppression est définitive. Rien ici ni ailleurs ne ramène une conversation : téléchargez-la d’abord si vous voulez une copie.',
  removed: 'Supprimée. {count} session(s) stockée(s) sont parties, y compris le travail délégué.',
  refused: 'Cette suppression a été refusée : {reason}',
  keeps: 'La suppression retire la conversation et tout ce qu’elle a délégué. Les fichiers que vous avez envoyés sont stockés par leur contenu et peuvent aussi appartenir à une autre conversation : leurs octets restent.',
}

/** de copy, checked complete against the English key set. */
export const de: Record<DataKey, string> = {
  nav: 'Daten',
  title: 'Ihre Unterhaltungen',
  intro: 'Jede Unterhaltung, die Sie öffnen können. Laden Sie eine Kopie herunter oder löschen Sie sie.',
  none: 'Sie haben noch keine Unterhaltungen.',
  lastActive: 'Zuletzt aktiv am {at}',
  export: 'Herunterladen',
  noExport: 'Diese Installation bietet keinen Download; löschen lässt sich eine Unterhaltung weiterhin.',
  delete: 'Löschen',
  deleteConfirm: 'Endgültig löschen',
  deleteCancel: 'Behalten',
  deleting: 'Wird gelöscht…',
  deleteWarning: 'Löschen ist endgültig. Nichts hier und nirgends sonst holt eine Unterhaltung zurück — laden Sie sie vorher herunter, wenn Sie eine Kopie möchten.',
  removed: 'Gelöscht. {count} gespeicherte Sitzung(en) sind weg, einschließlich der delegierten Arbeit.',
  refused: 'Dieses Löschen wurde abgelehnt: {reason}',
  keeps: 'Löschen entfernt die Unterhaltung und alles, was sie delegiert hat. Von Ihnen hochgeladene Dateien werden nach ihrem Inhalt gespeichert und können auch zu einer anderen Unterhaltung gehören, daher bleiben ihre Bytes erhalten.',
}

/** ru copy, checked complete against the English key set. */
export const ru: Record<DataKey, string> = {
  nav: 'Данные',
  title: 'Ваши разговоры',
  intro: 'Все разговоры, которые вы можете открыть. Скачайте копию или удалите разговор.',
  none: 'У вас пока нет разговоров.',
  lastActive: 'Последняя активность: {at}',
  export: 'Скачать',
  noExport: 'Эта установка не предлагает скачивание; удалить разговор по-прежнему можно.',
  delete: 'Удалить',
  deleteConfirm: 'Удалить окончательно',
  deleteCancel: 'Оставить',
  deleting: 'Удаление…',
  deleteWarning: 'Удаление необратимо. Ни здесь, ни где-либо ещё разговор не вернуть, поэтому сначала скачайте его, если нужна копия.',
  removed: 'Удалено. Ушло {count} сохранённых сессий, включая делегированную работу.',
  refused: 'Это удаление отклонено: {reason}',
  keeps: 'Удаление убирает разговор и всё, что он делегировал. Загруженные вами файлы хранятся по своему содержимому и могут принадлежать и другому разговору, поэтому их байты остаются.',
}

/** pt copy, checked complete against the English key set. */
export const pt: Record<DataKey, string> = {
  nav: 'Dados',
  title: 'As suas conversas',
  intro: 'Todas as conversas que pode abrir. Descarregue uma cópia ou elimine-a.',
  none: 'Ainda não tem conversas.',
  lastActive: 'Última atividade a {at}',
  export: 'Descarregar',
  noExport: 'Esta instalação não oferece descarregamento; uma conversa continua a poder ser eliminada.',
  delete: 'Eliminar',
  deleteConfirm: 'Eliminar definitivamente',
  deleteCancel: 'Manter',
  deleting: 'A eliminar…',
  deleteWarning: 'A eliminação é definitiva. Nada aqui nem em qualquer outro lugar traz uma conversa de volta, por isso descarregue-a antes se quiser uma cópia.',
  removed: 'Eliminada. Saíram {count} sessões guardadas, incluindo o trabalho que delegou.',
  refused: 'Essa eliminação foi recusada: {reason}',
  keeps: 'A eliminação remove a conversa e tudo o que ela delegou. Os ficheiros que enviou são guardados pelo seu conteúdo e podem pertencer também a outra conversa, pelo que os seus bytes permanecem.',
}

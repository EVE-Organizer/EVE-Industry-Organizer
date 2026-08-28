import { typeImageUrls } from './eve-image-urls.mjs'

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function stripTypeDescription(html) {
  if (!html) return ''
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function buildTypeLookupMaps(groups, categories) {
  const groupById = new Map(groups.map((group) => [group.groupID, group]))
  const categoryById = new Map(
    categories.map((category) => [category.categoryID, category.categoryName]),
  )
  return { groupById, categoryById }
}

export function buildAllTypeRecords(
  types,
  groupById,
  categoryById,
  blueprintTypeIds = [],
  { onlyIds } = {},
) {
  const includeTypeIds = onlyIds
    ? new Set([...onlyIds].map(String))
    : new Set(types.filter((type) => type.published === '1').map((type) => type.typeID))
  const unpublishedBlueprintIds = new Set(blueprintTypeIds.filter((id) => id != null).map(String))
  for (const typeId of unpublishedBlueprintIds) {
    includeTypeIds.add(String(typeId))
  }

  return types
    .filter((type) => {
      if (!includeTypeIds.has(type.typeID)) return false
      if (type.published === '1') return true
      return unpublishedBlueprintIds.has(type.typeID)
    })
    .map((type) => {
      const typeId = num(type.typeID)
      const group = groupById.get(type.groupID)
      const urls = typeImageUrls(typeId)
      const mass = num(type.mass)
      const description = stripTypeDescription(type.description)
      return {
        typeId,
        name: type.typeName,
        group: group?.groupName ?? 'Unknown',
        category: categoryById.get(group?.categoryID ?? '') ?? 'Unknown',
        volume: num(type.volume),
        ...(mass > 0 ? { mass } : {}),
        ...(description ? { description } : {}),
        iconUrl: urls.iconUrl,
        renderUrl: urls.renderUrl,
        bpIconUrl: urls.bpIconUrl,
      }
    })
    .sort((a, b) => a.typeId - b.typeId)
}

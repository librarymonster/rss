#!/usr/bin/env node
import { extract } from '@extractus/feed-extractor'
import readline from 'readline';
'use strict'

// extract a RSS
const sites = []

const descriptionCharacterCount = 800
const articlesCount = 25


const print = (a) => {
  console.log(a)
  return a;
}

const byPublishedDate = (a, b) => (new Date(b.published) - new Date(a.published))

const getEntries = (site) => site.entries
  .map((entry) => ({...entry, site}))

const dreamwidthWordCount = 300

const truncateWords = (text, maxWords) => {
  const matches = [...text.matchAll(/\S+/g)]

  if (matches.length <= maxWords) {
    return text
  }

  const cutoff = matches[maxWords - 1].index + matches[maxWords - 1][0].length

  return text.slice(0, cutoff).trim() + '...'
}

const dreamwidthHtmlToMarkdown = (html) => html
  .replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
  .replace(/<br\s*\/?>/gi, '\n\n')
  .replace(/<ul[^>]*>/gi, '\n')
  .replace(/<\/ul>/gi, '\n')
  .replace(/<li[^>]*>/gi, '\n- ')
  .replace(/<\/li>/gi, '\n')
  .replace(/<img[^>]*>/gi, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const raindropBaseUrl = 'https://librarymonster.raindrop.page/lm-io-collection-69723429'

const normalizeCategories = (category) => {
  if (!category) return []
  return Array.isArray(category) ? category : [category]
}

const raindropTagUrl = (tag) => {
  const cleanTag = String(tag).trim()
  const query = /[\s:\/]/.test(cleanTag)
    ? `#"${cleanTag}"`
    : `#${cleanTag}`

  return `${raindropBaseUrl}/view/sort=-created&search=${encodeURIComponent(query)}`
}

const mastodonTagUrl = (tag) =>
  `https://glammr.us/tags/${encodeURIComponent(tag.replace(/^#/, ''))}`

const formatTags = (tags, type) => {
  if (!tags.length) return ''

  const links = tags.map((tag) => {
    const cleanTag = String(tag).trim()
    const label = `#${cleanTag}`

    if (type === 'raindrop') {
      return `[${label}](${raindropTagUrl(cleanTag)})`
    }

    if (type === 'mastodon') {
      return `[${label}](${mastodonTagUrl(cleanTag)})`
    }

    return label
  })

  return `\n\nTags: ${links.join(' ')}`
}

const linkFediverseHashtags = (text) =>
  text.replace(/(^|\s)#([A-Za-z0-9_]+)/g, (match, prefix, tag) =>
    `${prefix}[#${tag}](${mastodonTagUrl(tag)})`
  )

const formatAsMarkdown = ({title, description, rawDescription, category, link, published, site}) => {
  const isDreamwidth = link.includes("librarymonster.dreamwidth.org")
  const isRaindrop = site.title.includes("LM.io Collection")
  const isMastodon = link.includes("glammr.us/@librarymonster")

  const tags = normalizeCategories(category)

  const body = isDreamwidth && rawDescription
    ? truncateWords(dreamwidthHtmlToMarkdown(rawDescription), dreamwidthWordCount)
    : isMastodon
      ? linkFediverseHashtags(description.slice(0, descriptionCharacterCount))
      : description.slice(0, descriptionCharacterCount)

  const tagLine = isRaindrop
    ? formatTags(tags, 'raindrop')
    : isMastodon
      ? formatTags(tags, 'mastodon')
      : ''

  return `
[${title}](${link})
---

${site.title} - ${new Date(published).toLocaleDateString()}

${body}${tagLine}
`
}
  const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (line) => {
  if (line.trim()) {
    sites.push(line.trim());
  }
});

rl.on('close', () => {
  Promise.allSettled(
  sites.map((site) => extract(site, {
    descriptionMaxLen: 0,
getExtraEntryFields: (feedEntry) => ({
  rawDescription: feedEntry.description || '',
  category: feedEntry.category || []
})  
  }))
)
    .then((results) => 
      results
        .flatMap((result, i) => {
          if (result.status === "fulfilled") {
            return [result.value]
          } else {
            process.stderr.write("Could not retrieve " + sites[i])
            return []
          }
        }) 
        .map(getEntries)
        .flat()
        .sort(byPublishedDate)
        // .map(print)
        .slice(0, articlesCount)
        .map(formatAsMarkdown)
        .join('\n')
      )
      .then(console.log)
});

rl.on('error', (err) => {
  console.log(err);
});

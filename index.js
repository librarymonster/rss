#!/usr/bin/env node
import { extract } from '@extractus/feed-extractor'
import readline from 'readline';
'use strict'

// extract a RSS
const sites = []

const descriptionCharacterCount = 1800
const articlesCount = 50


const print = (a) => {
  console.log(a)
  return a;
}

const byPublishedDate = (a, b) => (new Date(b.published) - new Date(a.published))

const getEntries = (site) => site.entries
  .map((entry) => ({...entry, site}))

const dreamwidthWordCount = 400

const truncateWords = (text, maxWords) => {
  const words = text.split(/\s+/).filter(Boolean)

  if (words.length <= maxWords) {
    return text
  }

  return words.slice(0, maxWords).join(' ') + '...'
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

const formatAsMarkdown = ({title, description, rawDescription, link, published, site}) => {
  const isDreamwidth = link.includes("librarymonster.dreamwidth.org")

  const body = isDreamwidth && rawDescription
    ? truncateWords(dreamwidthHtmlToMarkdown(rawDescription), dreamwidthWordCount)
    : description.slice(0, descriptionCharacterCount)

  return `
[${title}](${link})
---

${site.title} - ${new Date(published).toLocaleDateString()}

${body}
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
      rawDescription: feedEntry.description || ''
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

import * as core from '@actions/core'
import * as github from '@actions/github'
import { inspect } from 'util'
import simplegit from "simple-git/promise";

interface Inputs {
  token: string
  repository: string
  issueNumber: number
  currentBranch: string
  targetBranch: string
  setLinksOnPR: boolean
  domainFilters: string[]
}

interface Comment {
  id: number
  body?: string
}

function pretty(obj: any): string {
  return inspect(obj, { compact: false })
}

function filterLink(domainFilters: string[], link: String): boolean {
  if (domainFilters.length == 0) return true
  for (var filter of domainFilters) {
    if (link.includes(filter)) {
      return true
    }
  }
  return false
}

async function addLinksToPRBody(inputs: Inputs, links: String[]): Promise<undefined> {
  const octokit = github.getOctokit(inputs.token)
  const [owner, repo] = inputs.repository.split('/')

  const parameters = {
    owner: owner,
    repo: repo,
    issue_number: inputs.issueNumber,
    body: `Auto collected monday links:\n${links.join("\n")}`,
  }

  core.debug(`Update params: ${pretty(parameters)}`)
  var resp = await octokit.request("PATCH " + octokit.rest.issues.update.endpoint(parameters).url, parameters)
  core.debug(`Update: ${resp.status}`)
  return
}

async function findBody(inputs: Inputs, issueNumber: number): Promise<String[] | undefined> {
  const octokit = github.getOctokit(inputs.token)
  const [owner, repo] = inputs.repository.split('/')

  const parameters = {
    owner: owner,
    repo: repo,
    issue_number: issueNumber
  }

  const links: string[] = []
  for await (const { data: resp } of octokit.paginate.iterator(
    octokit.rest.issues.get,
    parameters
  )) {
    var body: String = resp.body
    var expression = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi
    var bodyMatch = body?.match(expression)
    if (bodyMatch) {
      for (var match of bodyMatch) {
        for (var item of match.split("\n")) {
          links.push(item)
        }
      }
    }
  }
  return links.filter(link => filterLink(inputs.domainFilters, link))
}

async function findComment(inputs: Inputs, issueNumber: number): Promise<String[] | undefined> {
  const octokit = github.getOctokit(inputs.token)
  const [owner, repo] = inputs.repository.split('/')

  const parameters = {
    owner: owner,
    repo: repo,
    issue_number: issueNumber
  }

  const links: string[] = []
  for await (const { data: comments } of octokit.paginate.iterator(
    octokit.rest.issues.listComments,
    parameters
  )) {
    for (var comment of comments) {
      if (comment) {
        var expression = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi
        var matches = comment.body?.match(expression)
        if (matches) {
          for (var match of matches) {
            links.push(match)
          }
        }
      }
    }

    return links.filter(link => filterLink(inputs.domainFilters, link))
  }
  return undefined
}

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

async function run(): Promise<void> {
  try {
    const inputs: Inputs = {
      token: core.getInput('token'),
      repository: core.getInput('repository'),
      issueNumber: Number(core.getInput('issue-number')),
      currentBranch: core.getInput('current-branch'),
      targetBranch: core.getInput('target-branch'),
      setLinksOnPR: Boolean(core.getInput('set-links-as-pr-comment')),
      domainFilters: core.getInput('domain-filters').split("|"),
    }

    core.debug(pretty(inputs));
    if (inputs.targetBranch.length == 0) {
      return
    }
    const git = simplegit()
    const logs = await git.log({
      from: inputs.currentBranch,
      to: inputs.targetBranch,
    })
    core.debug(`Log count: ${pretty(logs.all.length)}`);

    var links: String[] = []
    for (var log of logs.all) {
      core.debug(`Log: ${log.message}`);
      if (log.message.includes("Merge pull request")) {
        var expression = /#(\d*)/gi
        var matches = log.message?.match(expression)
        if (matches && matches.length > 0) {
          const issueNumber = Number.parseInt(matches[0].substring(1))
          core.debug(`Checking PR: #${issueNumber}`);
          var bodyLinks = await findBody(inputs, issueNumber)
          if (bodyLinks) {
            links = links?.concat(bodyLinks)
          }

          const commentLinks = await findComment(inputs, issueNumber)
          if (commentLinks) {
            links = links?.concat(commentLinks)
          }
        }
      }
    }

    links = links.filter(onlyUnique);
    core.debug(`Links found: ${pretty(links.length)}`);

    if (links) {
      core.setOutput('links', links.join("\n"))
    } else {
      core.setOutput('links', '')
    }

    if (inputs.setLinksOnPR) {
      addLinksToPRBody(inputs, links)
    }
  } catch (error: any) {
    core.debug(pretty(error))
    core.setFailed(error.message)
  }
}

run()

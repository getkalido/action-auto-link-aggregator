import * as core from "@actions/core";
import * as github from "@actions/github";
import { inspect } from "util";
import simplegit from "simple-git";
import axios, { AxiosResponse } from "axios";

interface Inputs {
  token: string;
  repository: string;
  issueNumber: number;
  currentBranch: string;
  targetBranch: string;
  includeAuthor: boolean;
  mondayToken: string;
  setLinksOnPR: boolean;
  domainFilters: string[];
}

interface Link {
  id: string;
  author: string;
  link: string;
  name: string;
}

interface MondayResponse {
  data: {
    items: [
      {
        id: string;
        name: string;
      }
    ];
  };
  account_id: string;
}

function pretty(obj: any): string {
  return inspect(obj, { compact: false });
}

function filterLink(domainFilters: string[], item: Link): boolean {
  if (domainFilters.length == 0) return true;
  for (var filter of domainFilters) {
    if (item.link.includes(filter)) {
      return true;
    }
  }
  return false;
}

async function addLinksToPRBody(
  inputs: Inputs,
  links: Link[]
): Promise<undefined> {
  const octokit = github.getOctokit(inputs.token);
  const [owner, repo] = inputs.repository.split("/");

  const parameters = {
    owner: owner,
    repo: repo,
    issue_number: inputs.issueNumber,
    body: `Auto collected monday links:\n${links
      .map((link) => `${link.author}: ${link.link}`)
      .join("\n")}`,
  };

  core.debug(`Update params: ${pretty(parameters)}`);
  var resp = await octokit.request(
    "PATCH " + octokit.rest.issues.update.endpoint(parameters).url,
    parameters
  );
  core.debug(`Update: ${resp.status}`);
  return;
}

async function findBody(
  inputs: Inputs,
  issueNumber: number
): Promise<Link[] | undefined> {
  const octokit = github.getOctokit(inputs.token);
  const [owner, repo] = inputs.repository.split("/");

  const parameters = {
    owner: owner,
    repo: repo,
    issue_number: issueNumber,
  };

  const links: Link[] = [];
  for await (const { data: resp } of octokit.paginate.iterator(
    octokit.rest.issues.get,
    parameters
  )) {
    var user: string = resp.user?.login ?? "UNKNOWN";
    var body: string = resp.body;
    var expression =
      /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi;
    var bodyMatch = body?.match(expression);
    if (bodyMatch) {
      for (var match of bodyMatch) {
        for (var item of match.split("\n")) {
          links.push(createLink(inputs, user, item));
        }
      }
    }
  }
  return links.filter((link) => filterLink(inputs.domainFilters, link));
}

async function findComment(
  inputs: Inputs,
  issueNumber: number
): Promise<Link[] | undefined> {
  const octokit = github.getOctokit(inputs.token);
  const [owner, repo] = inputs.repository.split("/");

  const parameters = {
    owner: owner,
    repo: repo,
    issue_number: issueNumber,
  };

  const links: Link[] = [];
  for await (const { data: comments } of octokit.paginate.iterator(
    octokit.rest.issues.listComments,
    parameters
  )) {
    for (var comment of comments) {
      if (comment) {
        var user: string = comment.user?.login ?? "UNKNOWN";
        var expression =
          /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi;
        var matches = comment.body?.match(expression);
        if (matches) {
          for (var match of matches) {
            links.push(createLink(inputs, user, match));
          }
        }
      }
    }

    return links.filter((link) => filterLink(inputs.domainFilters, link));
  }
  return undefined;
}

function createLink(inputs: Inputs, user: string, url: string): Link {
  var expression = /pulses\/(\d*)\/?/gi;
  var matches = url.match(expression);
  let id: string = "";
  if (matches && inputs.mondayToken != "") {
    for (var match of matches) {
      id = match.replace("pulses/", "").replace("/", "");
    }
  }

  return {
    id: id,
    author: user,
    link: url,
    name: "",
  };
}

async function fetchMondayDetails(
  inputs: Inputs,
  links: Link[]
): Promise<Link[]> {
  let ids: string[] = [];
  for (var link of links) {
    if (link.id != "") {
      ids.push(link.id);
    }
  }
  try {
    if (ids.length > 0 && inputs.mondayToken != "") {
      let query = "query { items (ids: [" + ids.join(",") + "]) { id name }}";

      let result: AxiosResponse = await axios.post(
        `https://api.monday.com/v2`,
        {
          query: query,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: inputs.mondayToken,
          },
        }
      );
      if (result.status == 200) {
        let posts: MondayResponse = result.data;
        if (posts.data.items.length > 0) {
          for (let data of posts.data.items) {
            for (var link of links) {
              if (link.id == data.id) {
                link.name = data.name;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    core.error(`Error fetching monday details: ${err}`);
  }
  return links;
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
      includeAuthor: Boolean(core.getInput('include-author')),
      mondayToken: core.getInput('mondayToken'),
      setLinksOnPR: Boolean(core.getInput('set-links-as-pr-comment')),
      domainFilters: core.getInput('domain-filters').split("|"),
    }

    core.debug(pretty(inputs));
    if (inputs.targetBranch.length == 0) {
      return;
    }
    const git = simplegit();
    const logs = await git.log({
      from: inputs.currentBranch,
      to: inputs.targetBranch,
    });
    core.debug(`Log count: ${pretty(logs.all.length)}`);

    var links: Link[] = [];
    for (var log of logs.all) {
      core.debug(`Log: ${log.message}`);
      if (log.message.includes("Merge pull request")) {
        var expression = /#(\d*)/gi;
        var matches = log.message?.match(expression);
        if (matches && matches.length > 0) {
          const issueNumber = Number.parseInt(matches[0].substring(1));
          core.debug(`Checking PR: #${issueNumber}`);
          var bodyLinks = await findBody(inputs, issueNumber);
          if (bodyLinks) {
            links = links?.concat(bodyLinks);
          }

          const commentLinks = await findComment(inputs, issueNumber);
          if (commentLinks) {
            links = links?.concat(commentLinks);
          }
        }
      }
    }

    if (inputs.mondayToken != "") {
      core.debug(`Fetching monday.com details`);
      links = await fetchMondayDetails(inputs, links);
    }

    links = links.filter(onlyUnique);
    core.debug(`Links found: ${pretty(links.length)}`);

    if (links) {
      core.setOutput("links", links);
    } else {
      core.setOutput("links", []);
    }

    if (inputs.setLinksOnPR) {
      addLinksToPRBody(inputs, links);
    }
  } catch (error: any) {
    core.debug(pretty(error));
    core.setFailed(error.message);
  }
}

run();

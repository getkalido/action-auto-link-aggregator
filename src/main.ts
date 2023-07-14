import * as core from "@actions/core";
import * as github from "@actions/github";
import { inspect } from "util";
import axios, { AxiosResponse } from "axios";
import { URL } from "url";

interface Inputs {
  token: string;
  repository: string;
  fromPROnly: boolean;
  issueNumber: number;
  currentBranch: string;
  targetBranch: string;
  includeAuthor: boolean;
  mondayToken: string;
  mondayDomainTokens: Map<string, string>;
  setLinksOnPR: boolean;
  domainFilters: string[];
}

interface Link {
  domain: string;
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
        column_values: [
          {
            id: string;
            text: string;
          }
        ]
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
  if (matches) {
    for (var match of matches) {
      id = match.replace("pulses/", "").replace("/", "");
    }
  }

  return {
    id: id,
    author: user,
    link: url,
    name: "",
    domain: (new URL(url)).host,
  };
}

async function fetchMondayDetails(
  inputs: Inputs,
  links: Link[]
): Promise<Link[]> {
  const allDomainIDs: Map<string, string[]> = new Map<string, string[]>()
  for (var link of links) {
    let arr = allDomainIDs.get(link.domain)
    if (!arr) {
      arr = []
    }

    if (link.id != "") {
      arr.push(link.id)
    }
    allDomainIDs.set(link.domain, arr);
  }

  try {
    let responseData = {}
    core.debug(`Fetching monday: ${allDomainIDs.size} items`);
    if (allDomainIDs.size > 0 && (inputs.mondayToken != "" || inputs.mondayDomainTokens.size > 0)) {
      for (let [domain, allIDs] of allDomainIDs) {
        let mondayToken: string = inputs.mondayDomainTokens.get(domain) || inputs.mondayToken
        core.debug(`Fetching ${domain} entries using ${mondayToken}`)


        var numberOfObjects = 30 // <-- decides number of objects in each group
        var groups = allIDs.reduce((acc, elem, index) => {
          var rowNum = Math.floor(index / numberOfObjects) + 1
          acc[rowNum] = acc[rowNum] || []
          acc[rowNum].push(elem)
          return acc
        }, {})
        core.debug(`Fetching in ${Object.keys(groups).length} batches`)
        for (var row in groups) {
          let ids = groups[row]
          let query = "query { items (ids: [" + ids.join(",") + "]) { id name column_values { id text }  }}";


          // mondayDomainTokens: Map<String,String>;

          let result: AxiosResponse = await axios.post(
            `https://api.monday.com/v2`,
            {
              query: query,
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: mondayToken,
              },
            }
          );
          if (result.status == 200) {
            let posts: MondayResponse = result.data;
            if (posts.data.items.length > 0) {
              for (let data of posts.data.items) {
                let item: Link = {
                  id: data.id,
                  name: data.name,
                  author: "",
                  link: "",
                  domain: domain,
                }
                for (var column of data.column_values) {
                  if (column.id == "person" || column.id == "task_owner") {
                    item.author = column.text
                  }
                }
                responseData[data.id] = item
              }
            }
          }
        }

        for (var link of links) {
          let data: Link = responseData[link.id]
          if (data) {
            link.name = data.name
            if (data.author) {
              link.author = data.author
            }
          } else {
            core.debug(`No data for ticket: ${JSON.stringify(link)}`)
          }
        }
      }
    }
  } catch (err) {
    core.error(`Error fetching monday details: ${err}`);
  }
  return links;
}

function onlyUnique(value: Link, index: number, self: Link[]) {
  return self.findIndex(v => v.id === value.id) === index;
}

async function run(): Promise<void> {
  try {
    core.debug(`CommentOnPRs: ${core.getInput('set-links-as-pr-comment')}`)

    const tokenMap = new Map<string, string>();
    core.getInput('mondayDomainTokens').split(",").map((n) => {
      const data = n.split("|")
      tokenMap.set(data[0], data[1])
    })
    const inputs: Inputs = {
      token: core.getInput('token'),
      repository: core.getInput('repository'),
      fromPROnly: core.getBooleanInput('from-pr-only'),
      issueNumber: Number(core.getInput('issue-number')),
      currentBranch: core.getInput('current-branch'),
      targetBranch: core.getInput('target-branch'),
      includeAuthor: core.getBooleanInput('include-author'),
      mondayToken: core.getInput('mondayToken'),
      mondayDomainTokens: tokenMap,
      setLinksOnPR: core.getBooleanInput('set-links-as-pr-comment'),
      domainFilters: core.getInput('domain-filters').split("|"),
    }

    core.debug(pretty(inputs));
    core.debug("")

    var fromPR = inputs.fromPROnly || inputs.currentBranch.length == 0

    var links: Link[] = [];
    if (fromPR) {
      core.debug(`Checking PR directly: #${inputs.issueNumber}`);
      var bodyLinks = await findBody(inputs, inputs.issueNumber);
      if (bodyLinks) {
        links = links?.concat(bodyLinks);
      }

      const commentLinks = await findComment(inputs, inputs.issueNumber);
      if (commentLinks) {
        links = links?.concat(commentLinks);
      }
    } else {
      if (inputs.targetBranch.length == 0) {
        return;
      }

      const octokit = github.getOctokit(inputs.token);
      const [owner, repo] = inputs.repository.split("/");

      let base = inputs.targetBranch.replace("origin/", "")
      let head = inputs.currentBranch.replace("origin/", "")

      const parameters = {
        owner: owner,
        repo: repo,
        basehead: base + "..." + head,
      };

      var resp = await octokit.request(
        "GET " + octokit.rest.repos.compareCommitsWithBasehead.endpoint(parameters).url,
      );

      for (var log of resp.data.commits) {
        let message = log.commit.message;
        if (message.includes("Merge pull request") && !message.includes("/" + base)) {
          var expression = /#(\d*)/gi;
          var matches = message?.match(expression);
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
    }

    if (inputs.mondayToken != "" || inputs.mondayDomainTokens.size > 0) {
      core.debug(`Fetching monday.com details`);
      links = await fetchMondayDetails(inputs, links);
    }

    links = links.filter(onlyUnique);
    core.debug(`Links found: ${pretty(links.length)}`);

    if (links) {
      core.setOutput("links", JSON.stringify(links));
      core.setOutput("linksB64", Buffer.from(JSON.stringify(links)).toString("base64"));
    } else {
      core.setOutput("links", []);
      core.setOutput("linksB64", "");
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

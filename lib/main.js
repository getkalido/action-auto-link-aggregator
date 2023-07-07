"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const util_1 = require("util");
const axios_1 = __importDefault(require("axios"));
const url_1 = require("url");
function pretty(obj) {
    return (0, util_1.inspect)(obj, { compact: false });
}
function filterLink(domainFilters, item) {
    if (domainFilters.length == 0)
        return true;
    for (var filter of domainFilters) {
        if (item.link.includes(filter)) {
            return true;
        }
    }
    return false;
}
function addLinksToPRBody(inputs, links) {
    return __awaiter(this, void 0, void 0, function* () {
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
        var resp = yield octokit.request("PATCH " + octokit.rest.issues.update.endpoint(parameters).url, parameters);
        core.debug(`Update: ${resp.status}`);
        return;
    });
}
function findBody(inputs, issueNumber) {
    var e_1, _a;
    var _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        const octokit = github.getOctokit(inputs.token);
        const [owner, repo] = inputs.repository.split("/");
        const parameters = {
            owner: owner,
            repo: repo,
            issue_number: issueNumber,
        };
        const links = [];
        try {
            for (var _d = __asyncValues(octokit.paginate.iterator(octokit.rest.issues.get, parameters)), _e; _e = yield _d.next(), !_e.done;) {
                const { data: resp } = _e.value;
                var user = (_c = (_b = resp.user) === null || _b === void 0 ? void 0 : _b.login) !== null && _c !== void 0 ? _c : "UNKNOWN";
                var body = resp.body;
                var expression = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi;
                var bodyMatch = body === null || body === void 0 ? void 0 : body.match(expression);
                if (bodyMatch) {
                    for (var match of bodyMatch) {
                        for (var item of match.split("\n")) {
                            links.push(createLink(inputs, user, item));
                        }
                    }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d.return)) yield _a.call(_d);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return links.filter((link) => filterLink(inputs.domainFilters, link));
    });
}
function findComment(inputs, issueNumber) {
    var e_2, _a;
    var _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        const octokit = github.getOctokit(inputs.token);
        const [owner, repo] = inputs.repository.split("/");
        const parameters = {
            owner: owner,
            repo: repo,
            issue_number: issueNumber,
        };
        const links = [];
        try {
            for (var _e = __asyncValues(octokit.paginate.iterator(octokit.rest.issues.listComments, parameters)), _f; _f = yield _e.next(), !_f.done;) {
                const { data: comments } = _f.value;
                for (var comment of comments) {
                    if (comment) {
                        var user = (_c = (_b = comment.user) === null || _b === void 0 ? void 0 : _b.login) !== null && _c !== void 0 ? _c : "UNKNOWN";
                        var expression = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi;
                        var matches = (_d = comment.body) === null || _d === void 0 ? void 0 : _d.match(expression);
                        if (matches) {
                            for (var match of matches) {
                                links.push(createLink(inputs, user, match));
                            }
                        }
                    }
                }
                return links.filter((link) => filterLink(inputs.domainFilters, link));
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_f && !_f.done && (_a = _e.return)) yield _a.call(_e);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return undefined;
    });
}
function createLink(inputs, user, url) {
    var expression = /pulses\/(\d*)\/?/gi;
    var matches = url.match(expression);
    let id = "";
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
        domain: (new url_1.URL(url)).host,
    };
}
function fetchMondayDetails(inputs, links) {
    return __awaiter(this, void 0, void 0, function* () {
        const allDomainIDs = new Map();
        for (var link of links) {
            let arr = allDomainIDs.get(link.domain);
            if (!arr) {
                arr = [];
            }
            if (link.id != "") {
                arr.push(link.id);
            }
            allDomainIDs.set(link.domain, arr);
        }
        try {
            let responseData = {};
            core.debug(`Fetching monday: ${allDomainIDs.size} items`);
            if (allDomainIDs.size > 0 && (inputs.mondayToken != "" || inputs.mondayDomainTokens.size > 0)) {
                for (let [domain, allIDs] of allDomainIDs) {
                    let mondayToken = inputs.mondayDomainTokens.get(domain) || inputs.mondayToken;
                    core.debug(`Fetching ${domain} entries using ${mondayToken}`);
                    var numberOfObjects = 30; // <-- decides number of objects in each group
                    var groups = allIDs.reduce((acc, elem, index) => {
                        var rowNum = Math.floor(index / numberOfObjects) + 1;
                        acc[rowNum] = acc[rowNum] || [];
                        acc[rowNum].push(elem);
                        return acc;
                    }, {});
                    core.debug(`Fetching in ${Object.keys(groups).length} batches`);
                    for (var row in groups) {
                        let ids = groups[row];
                        let query = "query { items (ids: [" + ids.join(",") + "]) { id name column_values { id text }  }}";
                        // mondayDomainTokens: Map<String,String>;
                        let result = yield axios_1.default.post(`https://api.monday.com/v2`, {
                            query: query,
                        }, {
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: mondayToken,
                            },
                        });
                        if (result.status == 200) {
                            let posts = result.data;
                            if (posts.data.items.length > 0) {
                                for (let data of posts.data.items) {
                                    let item = {
                                        id: data.id,
                                        name: data.name,
                                        author: "",
                                        link: "",
                                        domain: domain,
                                    };
                                    for (var column of data.column_values) {
                                        if (column.id == "person") {
                                            item.author = column.text;
                                        }
                                    }
                                    responseData[data.id] = item;
                                }
                            }
                        }
                    }
                    for (var link of links) {
                        let data = responseData[link.id];
                        if (data) {
                            link.name = data.name;
                            link.author = data.author;
                        }
                        else {
                            core.debug(`No data for ticket: ${JSON.stringify(link)}`);
                        }
                    }
                }
            }
        }
        catch (err) {
            core.error(`Error fetching monday details: ${err}`);
        }
        return links;
    });
}
function onlyUnique(value, index, self) {
    return self.findIndex(v => v.id === value.id) === index;
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            core.debug(`CommentOnPRs: ${core.getInput('set-links-as-pr-comment')}`);
            const tokenMap = new Map();
            core.getInput('mondayDomainTokens').split(",").map((n) => {
                const data = n.split("|");
                tokenMap.set(data[0], data[1]);
            });
            const inputs = {
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
            };
            core.debug(pretty(inputs));
            core.debug("");
            var fromPR = inputs.fromPROnly || inputs.currentBranch.length == 0;
            var links = [];
            if (fromPR) {
                core.debug(`Checking PR directly: #${inputs.issueNumber}`);
                var bodyLinks = yield findBody(inputs, inputs.issueNumber);
                if (bodyLinks) {
                    links = links === null || links === void 0 ? void 0 : links.concat(bodyLinks);
                }
                const commentLinks = yield findComment(inputs, inputs.issueNumber);
                if (commentLinks) {
                    links = links === null || links === void 0 ? void 0 : links.concat(commentLinks);
                }
            }
            else {
                if (inputs.targetBranch.length == 0) {
                    return;
                }
                const octokit = github.getOctokit(inputs.token);
                const [owner, repo] = inputs.repository.split("/");
                let base = inputs.targetBranch.replace("origin/", "");
                let head = inputs.currentBranch.replace("origin/", "");
                const parameters = {
                    owner: owner,
                    repo: repo,
                    basehead: base + "..." + head,
                };
                var resp = yield octokit.request("GET " + octokit.rest.repos.compareCommitsWithBasehead.endpoint(parameters).url);
                for (var log of resp.data.commits) {
                    let message = log.commit.message;
                    if (message.includes("Merge pull request") && !message.includes("/" + base)) {
                        var expression = /#(\d*)/gi;
                        var matches = message === null || message === void 0 ? void 0 : message.match(expression);
                        if (matches && matches.length > 0) {
                            const issueNumber = Number.parseInt(matches[0].substring(1));
                            core.debug(`Checking PR: #${issueNumber}`);
                            var bodyLinks = yield findBody(inputs, issueNumber);
                            if (bodyLinks) {
                                links = links === null || links === void 0 ? void 0 : links.concat(bodyLinks);
                            }
                            const commentLinks = yield findComment(inputs, issueNumber);
                            if (commentLinks) {
                                links = links === null || links === void 0 ? void 0 : links.concat(commentLinks);
                            }
                        }
                    }
                }
            }
            if (inputs.mondayToken != "" || inputs.mondayDomainTokens.size > 0) {
                core.debug(`Fetching monday.com details`);
                links = yield fetchMondayDetails(inputs, links);
            }
            links = links.filter(onlyUnique);
            core.debug(`Links found: ${pretty(links.length)}`);
            if (links) {
                core.setOutput("links", JSON.stringify(links));
                core.setOutput("linksB64", Buffer.from(JSON.stringify(links)).toString("base64"));
            }
            else {
                core.setOutput("links", []);
                core.setOutput("linksB64", "");
            }
            if (inputs.setLinksOnPR) {
                addLinksToPRBody(inputs, links);
            }
        }
        catch (error) {
            core.debug(pretty(error));
            core.setFailed(error.message);
        }
    });
}
run();

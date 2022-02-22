"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
const promise_1 = __importDefault(require("simple-git/promise"));
function pretty(obj) {
    return (0, util_1.inspect)(obj, { compact: false });
}
function filterLink(domainFilters, link) {
    if (domainFilters.length == 0)
        return true;
    for (var filter of domainFilters) {
        if (link.includes(filter)) {
            return true;
        }
    }
    return false;
}
function addLinksToPRBody(inputs, links) {
    return __awaiter(this, void 0, void 0, function* () {
        const octokit = github.getOctokit(inputs.token);
        const [owner, repo] = inputs.repository.split('/');
        const parameters = {
            owner: owner,
            repo: repo,
            issue_number: inputs.issueNumber,
            body: `Auto collected monday links:\n${links.join("\n")}`,
        };
        core.debug(`Update params: ${pretty(parameters)}`);
        var resp = yield octokit.request("PATCH " + octokit.rest.issues.update.endpoint(parameters).url, parameters);
        core.debug(`Update: ${resp.status}`);
        return;
    });
}
function findBody(inputs, issueNumber) {
    var e_1, _a;
    return __awaiter(this, void 0, void 0, function* () {
        const octokit = github.getOctokit(inputs.token);
        const [owner, repo] = inputs.repository.split('/');
        const parameters = {
            owner: owner,
            repo: repo,
            issue_number: issueNumber
        };
        const links = [];
        try {
            for (var _b = __asyncValues(octokit.paginate.iterator(octokit.rest.issues.get, parameters)), _c; _c = yield _b.next(), !_c.done;) {
                const { data: resp } = _c.value;
                var body = resp.body;
                var expression = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi;
                var bodyMatch = body === null || body === void 0 ? void 0 : body.match(expression);
                if (bodyMatch) {
                    for (var match of bodyMatch) {
                        for (var item of match.split("\n")) {
                            links.push(item);
                        }
                    }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) yield _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return links.filter(link => filterLink(inputs.domainFilters, link));
    });
}
function findComment(inputs, issueNumber) {
    var e_2, _a;
    var _b;
    return __awaiter(this, void 0, void 0, function* () {
        const octokit = github.getOctokit(inputs.token);
        const [owner, repo] = inputs.repository.split('/');
        const parameters = {
            owner: owner,
            repo: repo,
            issue_number: issueNumber
        };
        const links = [];
        try {
            for (var _c = __asyncValues(octokit.paginate.iterator(octokit.rest.issues.listComments, parameters)), _d; _d = yield _c.next(), !_d.done;) {
                const { data: comments } = _d.value;
                for (var comment of comments) {
                    if (comment) {
                        var expression = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi;
                        var matches = (_b = comment.body) === null || _b === void 0 ? void 0 : _b.match(expression);
                        if (matches) {
                            for (var match of matches) {
                                links.push(match);
                            }
                        }
                    }
                }
                return links.filter(link => filterLink(inputs.domainFilters, link));
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) yield _a.call(_c);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return undefined;
    });
}
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}
function run() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const inputs = {
                token: core.getInput('token'),
                repository: core.getInput('repository'),
                issueNumber: Number(core.getInput('issue-number')),
                currentBranch: core.getInput('current-branch'),
                targetBranch: core.getInput('target-branch'),
                setLinksOnPR: Boolean(core.getInput('set-links-as-pr-comment')),
                domainFilters: core.getInput('domain-filters').split("|"),
            };
            core.debug(pretty(inputs));
            if (inputs.targetBranch.length == 0) {
                return;
            }
            const git = (0, promise_1.default)();
            const logs = yield git.log({
                from: inputs.currentBranch,
                to: inputs.targetBranch,
            });
            core.debug(`Log count: ${pretty(logs.all.length)}`);
            var links = [];
            for (var log of logs.all) {
                core.debug(`Log: ${log.message}`);
                if (log.message.includes("Merge pull request")) {
                    var expression = /#(\d*)/gi;
                    var matches = (_a = log.message) === null || _a === void 0 ? void 0 : _a.match(expression);
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
            links = links.filter(onlyUnique);
            core.debug(`Links found: ${pretty(links.length)}`);
            if (links) {
                core.setOutput('links', links.join("\n"));
            }
            else {
                core.setOutput('links', '');
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

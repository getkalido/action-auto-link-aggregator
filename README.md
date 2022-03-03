# Find links in comments

A GitHub action to find an issue or pull request comment with links and optionally set them as the body of the current pull request.

The action will output the links found based on the criteria given

Original source based off of https://github.com/peter-evans/find-comment

## Usage

### Find links in comments for the specific domains

```yml
      - name: Find links in comment
        uses: getkalido/action-auto-link-aggregator@main
        id: fc
        with:
          issue-number: 1
          domain-filters: monday.com|github.com
```

### Find any links in comments

```yml
      - name: Find links in comment
        uses: getkalido/action-auto-link-aggregator@main
        id: fc
        with:
          issue-number: 1
```

### Find links for domains and update pull request

```yml
      - name: Find links in comment
        uses: getkalido/action-auto-link-aggregator@main
        id: fc
        with:
          issue-number: 1
          domain-filters: monday.com|github.com
          set-links-as-pr-comment: true
```

### Action inputs

| Name | Description | Default |
| --- | --- | --- |
| `token` | `GITHUB_TOKEN` or a `repo` scoped [PAT](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token). | `GITHUB_TOKEN` |
| `repository` | The full name of the repository containing the issue or pull request. | `github.repository` (Current repository) |
| `current-branch` | The current branch that the repo is on. | HEAD |
| `issue-number` | The target/base branch of the PR. | origin/staging |
| `issue-number` | The number of the issue or pull request in which to search. | github.event.pull_request.number |
| `domain-filters` | Filters for the links to include only certain ones. | |
| `set-links-as-pr-comment` | Flag to set the links found as the body on the PR | false |

#### Outputs

The `links` and `authors` of the comments matchng the domians found will be output for use in later steps.
They will be empty strings if no matching comment was found.
Note that in order to read the step outputs the action step must have an id.

```yml
      - name: Find links in comment
        uses: getkalido/action-auto-link-aggregator@main
        id: fc
        with:
          issue-number: 1
          domain-filters: monday.com|github.com
      - run: |
          echo ${{ steps.fc.outputs.links }}
          echo ${{ steps.fc.outputs.authors }}
```

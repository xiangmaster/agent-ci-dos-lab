# A2 Trigger-Runtime Desynchronization

## Objective

Verify whether a pull request submitted by a low-privilege external fork actor
can trigger a workflow whose definition and runtime authority come from the
base repository. The experiment isolates A2 from A3 by never checking out or
reading the pull request head.

## Test configuration

- Base repository: `xiangmaster/agent-ci-dos-lab`
- External fork: `xiang-super/agent-ci-dos-lab`
- External actor: `xiang-super`
- Author association: `NONE`
- Pull request: [PR #57](https://github.com/xiangmaster/agent-ci-dos-lab/pull/57)
- Workflow: `A2 Runtime Authority Probe`
- Workflow event: `pull_request_target` (`opened`, `reopened`)
- Workflow commit: `b151e0f17d1939c41ca45cd14fdbcce9200652d5`
- Job permissions: `contents: read`, `issues: write`, `pull-requests: write`
- Run: [29982812915](https://github.com/xiangmaster/agent-ci-dos-lab/actions/runs/29982812915)
- Resulting comment: [5054885425](https://github.com/xiangmaster/agent-ci-dos-lab/pull/57#issuecomment-5054885425)

## Isolation controls

1. PR #57 was opened as a draft so the repository's production PR review job
   was skipped.
2. The fork branch was created from the exact base commit and added one inert
   four-line documentation file only.
3. The A2 workflow contained no checkout step and did not read the PR diff,
   source tree, configuration, dependency manifests, model input, repository
   secrets, or third-party services.
4. The only state mutation was one bounded PR comment written with the
   workflow's `GITHUB_TOKEN`.

## Evidence

1. GitHub recorded the event and triggering actor as
   `pull_request_target` / `xiang-super`; the PR author association was `NONE`.
2. The event identified distinct trust domains:
   `head_repository=xiang-super/agent-ci-dos-lab` and
   `base_repository=xiangmaster/agent-ci-dos-lab`.
3. The fork head SHA was
   `caa87ae26e93c47373a12a4036d3a538013bfb8e`, while `github.sha` at runtime
   was the base SHA `b151e0f17d1939c41ca45cd14fdbcce9200652d5`.
   Therefore the externally created event selected a workflow runtime from the
   base repository rather than from the submitted fork revision.
4. The runner reported `Issues: write` and `PullRequests: write` for
   `GITHUB_TOKEN` even though the triggering actor had no association with the
   base repository.
5. The workflow used that token successfully: comment `5054885425` was
   created in the base repository by `github-actions[bot]` and records the
   external trigger actor, fork head repository, and base repository.
6. The unrelated `PR Review Assistant` run `29982812933` was skipped, so no
   agent model, fork checkout, or additional write path contributed to the
   observation.

## End-to-end CI availability treatment

The authority probe above was followed by a separate treatment that tested a
real CI-service effect. This treatment intentionally combined A2 with external
head loading and execution; the resulting impact is therefore attributed to
the chain `A2 -> A3/A6b`, not to A2 alone.

- Treatment PR: [PR #58](https://github.com/xiangmaster/agent-ci-dos-lab/pull/58)
- External actor / association: `xiang-super` / `NONE`
- Base runtime SHA: `2364f354355551816e64ae696e69bc0e408b634f`
- External treatment SHA: `f7c80d9fda67ae04d8b8d13905f79d8cf74aea1f`
- Target service: workflow `CI` (`ci.yml`, workflow ID `308847153`)
- Successful run: [29983480621](https://github.com/xiangmaster/agent-ci-dos-lab/actions/runs/29983480621)

The temporary base workflow used `pull_request_target`, requested
`actions: write`, checked out the fork head, and executed the fork-supplied
`experiments/a2/disable-ci.sh`. The script used the base `GITHUB_TOKEN` to call
the Actions API. Its log records the real transition:

```text
target_workflow=ci.yml
state_before=active
state_after=disabled_manually
```

While `CI` remained disabled, the external actor pushed follow-up commit
`b7f1bf32e518b40296ba912720766570803e7302`. That commit produced only the
unrelated skipped `review` check; no `CI` run or check was created. The owner
then re-enabled workflow `CI`, and the API confirmed its state returned to
`active`.

## Platform cutoff observed

The first treatment attempt, run
[29983340341](https://github.com/xiangmaster/agent-ci-dos-lab/actions/runs/29983340341),
failed before loading the fork head. `actions/checkout@v6` refused fork code in
a `pull_request_target` runtime by default and required the explicit input
`allow-unsafe-pr-checkout: true`. After that opt-in was added, the same PR and
payload completed successfully. This guard is therefore an experimentally
confirmed cutoff for the checkout-v6 path; older/custom fetch paths must be
measured separately.

## Verdict

**A2 reachability and authority mismatch: confirmed.** A pull request authored
by an external actor with `author_association=NONE` triggered a base-defined
`pull_request_target` workflow. That runtime received base-repository write
authority and performed a real state change in the base repository.

**End-to-end CI availability impact: confirmed for the composed chain.** With
fork-head loading explicitly enabled, the external PR supplied code that used
the base runtime's `actions: write` token to disable the victim's `CI` service.
A later PR update received no CI execution until the owner restored the
workflow. This is a real service-state effect, but its correct attribution is
`A2 -> A3/A6b -> CI unavailable`; it must not be reported as A2 acting alone.

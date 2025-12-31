import * as sandbox from "./sandbox";
import * as cloudflareBindings from "./cloudflare-mcp/bindings/index_base_tool";
import * as jules from "./jules/index_base_tool";
import * as github from "./github/index_base_tool";

export function getAllTools(env: Env) {
  return [
    new sandbox.ContainerInitializeTool(env),
    new sandbox.ContainerPingTool(env),
    new sandbox.ContainerExecTool(env),
    new sandbox.ContainerFileWriteTool(env),
    new sandbox.ContainerFileReadTool(env),
    new sandbox.ContainerFilesListTool(env),
    new sandbox.ContainerFileDeleteTool(env),
    new sandbox.RunPythonScriptTool(env),
    new sandbox.RunNotebookTool(env),

    new cloudflareBindings.CfAccountListTool(env),
    new cloudflareBindings.CfWorkerListTool(env),
    new cloudflareBindings.CfWorkerGetTool(env),
    new cloudflareBindings.CfKvListTool(env),
    new cloudflareBindings.CfKvCreateTool(env),
    new cloudflareBindings.CfD1ListTool(env),
    new cloudflareBindings.CfD1CreateTool(env),
    new cloudflareBindings.CfD1QueryTool(env),
    new cloudflareBindings.CfR2ListTool(env),
    new cloudflareBindings.CfR2CreateTool(env),
    new cloudflareBindings.CfHyperdriveListTool(env),
    new cloudflareBindings.CfHyperdriveCreateTool(env),

    new jules.JulesActivityTool(env),
    new jules.JulesListSessionsTool(env),
    new jules.JulesCreateSessionTool(env),
    new jules.JulesGetActivityTool(env),
    new jules.JulesSendMessageTool(env),
    new jules.JulesGetUnifiedActivityTool(env),
    new jules.JulesEnrichContextTool(env),

    new github.GithubReadFileTool(env),
    new github.GithubListFilesTool(env),
    new github.GithubPushFileTool(env),
    new github.GithubListIssuesTool(env),
    new github.GithubCreateIssueTool(env),
    new github.GithubUpdateIssueTool(env),
    new github.GithubAddIssueCommentTool(env),
    new github.GithubListPullRequestsTool(env),
    new github.GithubGetPullRequestTool(env),
    new github.GithubCreatePullRequestTool(env),
    new github.GithubMergePullRequestTool(env),
    new github.GithubCreateBranchTool(env),
    new github.GithubSearchCodeTool(env),
  ];
}
Create a job to test GitHub CLI authentication and access by:
1. Run `gh auth status` to check authentication state
2. Run `gh pr list` to test authenticated GitHub API access (requires auth)
3. Run `gh repo view` to get repository information
4. Echo all results to the log for verification
5. Report back the authentication status and any errors
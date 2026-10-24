<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
ALQU tenant retirement is a persisted next-month cutoff, not a physical deletion; all monthly lists share the pure month-visibility helper so historical tenant identities and receipts remain available.
ALQU registration dates use the persisted created_at timestamp rather than an inferred tenancy start date, so existing records show their actual registration date.

# DS-160 Auto-Review Notes

## Confirmed Risk

- `Work/Education: Previous` can hit a CEAC `Application Error` when previous school or employer text is too long.
- This was confirmed by manual retry: trimming the previous school or employer content allowed the flow to continue.

## Priorities For Later Auto-Review

- Check length risk for previous school / employer name.
- Check length risk for previous school / employer address.
- Check length risk for `Course of Study`.
- Check length risk for duties / description style free-text fields on the previous work-education page.

## Status

- This is a confirmed real-world rule and should be included in later DS-160 precheck / auto-review logic.

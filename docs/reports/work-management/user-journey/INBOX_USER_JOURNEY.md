# Inbox — User Journey (Tenant Owner)

**Account:** Dapi Owner (`dapi.onexso.com:4200`, tenant *Dapi Technologies*)
**Captured:** 2026-10-23, local dev environment, viewport 1440 px wide
**Companion document:** [Work Management user journey](WORK_MANAGEMENT_USER_JOURNEY.md). The Inbox is where Work Management approvals are decided.

Pages that scroll were captured top to bottom in one image. Most dialogs were opened for the screenshot and then **cancelled**. To show the full decision journey, exactly **two** demo tickets were decided, with the user's approval: Mathusanth Kumaran's *Change allocated hours* (+40h, Pos System) was **approved**, and his *Add new task* (Add regression suite task) was **rejected** with a reason (Part B, steps B7–B11). Nothing else was changed.

---

## What the Inbox is

The Inbox is the single place where a manager **receives tickets** (requests and alerts), **discusses** them and **resolves** them. It replaced the old separate approval and alert screens. Each ticket is a **case card** in a chat:

- **Direct message (DM):** one chat per person. Every request *from* that person and every alert *about* that person arrives in that chat.
- **Group:** created for a case that needs several people (for example an escalated exception), or by hand.

### Ticket types the owner sees

| Type | Source | Example | Resolve actions |
|------|--------|---------|-----------------|
| Work approval | Work Management | *Change allocated hours* (+40h), *Add new task* | Edit → Approve, Reject (optional reason) |
| Exception case | Monitoring / attendance identity | *Attendance identity verification requires review* | Resolve with an outcome |
| Attendance alert | Attendance | *Late clock-in*, *Early clock-out* | Resolve with an outcome |
| Leave request | Time Off | *Sick Leave*, *Annual Leave* | Approve / Reject (closed ones show history) |

### Ticket lifecycle

```
Raised (by employee or detected by system)
   └─► arrives as a case card in the person's DM  (badge = "waiting on you")
         ├─► open card → Ticket details (request details, evidence, steps)
         ├─► discuss: chat, reply-with-quote, add people, start a group, forward
         ├─► decide:
         │     Work / Leave  → Edit (optional) → Approve   or   Reject (+reason)
         │     Alert / Case  → Resolve → "No issue – clear it" | "Real issue – keep on record"
         ├─► not decided in time → escalated automatically up the reporting line / to HR
         └─► Closed → card turns grey "Closed", result card added (approved / rejected),
                       steps timeline records who decided and when
```

---

## Part A: Finding your tickets

### A1. Inbox home

![Inbox home](screenshots/inbox/i01-inbox-home.png)

Open **Inbox** from the sidebar. Its badge (9+) counts the tickets waiting on you.

- **Groups:** case groups such as the escalated *Attendance identity verification* cases.
- **Direct messages:** one row per person. The orange number is how many of that person's tickets are waiting on you.
- An empty conversation pane says *"Requests and alerts arrive in the chat with the person they are about."*

### A2. Pending filter

![Pending](screenshots/inbox/i02-inbox-pending-filter.png)

**Pending (34)** hides chats that have nothing waiting on you, so only work-to-do remains.

![Pending type filter](screenshots/inbox/i02b-pending-type-filter.png)

In Pending mode, the **type** dropdown narrows the list to *Work approval*, *Exception case* or *Attendance alert*.

### A3. Search

![Search](screenshots/inbox/i03-inbox-search.png)

The search icon filters groups and people by name. Here *"Na"* matches Nadesh, Nadarajah and others. The **+** next to *Direct messages* (New message) opens the same search to start a chat with anyone.

### A4. Notification bell

![Notifications](screenshots/inbox/i28-notification-bell.png)

New tickets and escalations also show in the bell, for example *"Escalated to HR: Attendance identity verification requires review"*. Clicking a notification opens that ticket in the Inbox. **Mark all read** clears the bell.

---

## Part B: Work Management approvals (the main WM journey)

### B1. A person's chat with their requests

![DM with work approvals](screenshots/inbox/i15-dm-work-approvals.png)

Opening **Mathusanth Kumaran** shows two pending Work Management tickets as case cards:

- **Change allocated hours:** *Allocation · +40h, need more hours for architecture depth*. It was raised from *Request more hours* in the Tree tab.
- **Add new task:** *Task Creation*. It was raised when a member who cannot create tasks directly asks for one.

Each card has **Approve** and **Reject** inline. The right panel's **October 2026** tab lists all of that person's requests and alerts for the month with their status (Open, Resolved, Rejected). Use the arrows to change the month.

### B2. Ticket details: change allocated hours

![Allocation ticket details](screenshots/inbox/i16-work-approval-ticket-details.png)

Clicking a card selects it and opens **Ticket details**:

- **Header:** title, project (*Pos System*), the request summary and a **Pending** status chip.
- **Request details:** additional hours (40 hours) and requested-on time.
- **Request steps:** *Requested by Mathusanth Kumaran*, then *Waiting for Dapi Owner*.
- The footer has **Reject / Approve**. **Start a group** pulls more people into a dedicated chat for this ticket.

### B3. Edit before approving

![Edit before approve](screenshots/inbox/i17-work-approval-edit-before-approve.png)

**Edit** on the card opens the change set: *Current: none · Requested: 40 h*. The approver can change the requested value (for example approve 30h instead of 40h) and then press **Approve**. The edited value is what gets applied.

### B4. Reject with a reason

![Reject dialog](screenshots/inbox/i18-reject-reason-dialog.png)

**Reject** asks for an optional reason, which the requester sees in the chat. You can choose **Reject** (with the reason), **Reject without reason** or **Cancel**.

### B5. Ticket details: add new task

![Task creation details](screenshots/inbox/i19-task-creation-ticket-details.png)

A *Task Creation* ticket shows the proposed task: **Title** (*Add regression suite task*), **Priority** (medium), **Estimated hours** (8h). The card's **Edit** lets the approver adjust these before approving. Steps show who it is waiting for (*Nevi Peiris*). The tenant owner can still act on it.

### B6. Card options

![Work card menu](screenshots/inbox/i20-work-card-options-menu.png)

The **⋮** on a card offers **Reply** (quote the ticket in the chat), **Start a group for this case** and **Forward** (share the ticket into another chat).

### B7. Approve: the decision and the undo window

![After approve](screenshots/inbox/i29-after-approve-revert-window.png)

Pressing **Approve** on *Change allocated hours* applies the decision immediately. There is no confirmation dialog, and a **Done** toast appears.

- The ticket chip changes to **Approved**, with *Approved on Oct 23, 2026, 11:57 AM*.
- The card loses its Approve and Reject buttons.
- **Request steps** gains *Approved · Dapi Owner*.
- An **Undo** bar appears: *"Undo — available until 12:27 PM"*, with a live 30-minute countdown (29:57).

### B8. Undo (revert) a decision

![Undo confirm](screenshots/inbox/i30-undo-confirm.png)

**Undo** asks *"Revert this decision?"*. If you confirm, the decision is undone and the request reopens as Pending for a new decision. **Cancel** keeps the decision. Here it was cancelled, so the approval stands. The Pending counter already dropped from 34 to 33 after the approval.

### B9. Reject with a reason

![Reject with reason](screenshots/inbox/i31-reject-with-reason-filled.png)

For *Add new task*, **Reject** opens the reason dialog. The reason entered was *"A regression suite task already exists in this sprint - please reuse it."* Then **Reject** is pressed.

![After reject](screenshots/inbox/i32-after-reject.png)

The ticket changes to **Rejected**. The steps show *Rejected · Dapi Owner* with the reason underneath, and the same 30-minute **Undo** bar is offered.

### B10. The chat after both decisions

![Chat after decisions](screenshots/inbox/i33-chat-after-decisions.png)

After a refresh, both original cards are grey and **Closed**. The cards are renamed to what they are about: *Pos System* and *Add regression suite task*. Under **Today**, two result cards are posted so the requester sees the outcome in the chat:

- **Pos System approved:** green, *+40h, Approved by Dapi Owner on Oct 23, 2026, 11:57 AM*.
- **Add regression suite task rejected:** red, *Rejected by Dapi Owner on Oct 23, 2026, 11:57 AM*.

Pending is now **32**. Mathusanth's chat has nothing waiting any more, so it drops to the bottom of the list without a badge.

### B11. History of my decisions

![History with decisions](screenshots/inbox/i34-history-with-decisions.png)

Header **⋯ → History** now lists both decisions, newest first. The rejection shows its reason in quotes. This is the decider's audit trail.

### B12. An older closed work ticket

![Closed project ticket](screenshots/inbox/i26-closed-project-ticket.png)

Closed tickets keep their full record. In Nilaxan Sritharan's chat, *Device Connectivity Framework* (+35h, Protocol adapter expansion) was rejected on Oct 22. The red result card stays in the chat, and the ticket details show the **Rejected** chip and the step *Rejected · Dapi Owner* with its reason.

---

## Part C: Resolving exception cases (group tickets)

### C1. An escalated exception case

![Exception case group](screenshots/inbox/i04-exception-case-group.png)

The **Groups** entry *Attendance identity verification requires review* is an **Exception case** for Vithya Ganeshalingam.

- The chat shows the case card with **Resolve** and system messages: *Group started…* and *Escalated to Dapi Owner*.
- **Ticket details:** red **Escalated** chip and the reason (*Face verification retries were exhausted during clock-in*).
- **Evidence & details:** each face check with time, event, result and match score. In this case: 8:58 Clock-in *Failed 61%*, 9:01 Clock-in *Let through 64%*, 6:01 PM Clock-out *Passed 95%*.
- **Request steps:** Detected → Escalated automatically → Escalated (*a teammate, not reviewed in time*) → Group started → Escalated to Dapi Owner → **Waiting for review**.

### C2. Resolve with an outcome

![Resolve dialog](screenshots/inbox/i05-resolve-outcome-dialog.png)

**Resolve** asks *"What did you find?"*:

- **No issue – clear it:** there was a valid reason (camera or lighting problem, agreed absence). It does not count against the employee.
- **Real issue – keep on record:** the case is closed but stays on the employee's record.

An optional note is saved with the decision.

### C3. Case options, people and sharing

![Case menu](screenshots/inbox/i06-case-options-menu.png)

The case card **⋮** offers **Reply**, **Open group** and **Forward**.

![Add member](screenshots/inbox/i08-add-people-dialog.png)

The **add-person** icon in the chat header adds a member to the group (search, select, **Add**). Use it to bring in HR or the employee's manager.

![Forward](screenshots/inbox/i09-forward-dialog.png)

**Forward** sends the ticket into one or more chats or case groups, with checkboxes and search.

### C4. Chat header options: members, history, delegation

![Header menu](screenshots/inbox/i07-chat-header-options.png)

The **⋯** in the chat header has **Members**, **History** and **Delegate my approvals**.

![Members](screenshots/inbox/i10-members-panel.png)

**Members** lists everyone in the chat (here *Vithya Ganeshalingam* and *You*).

![History](screenshots/inbox/i11-history-panel.png)

**History** lists the decisions you have taken (*"Decisions you take show up here."*). It is your audit trail.

![Delegate](screenshots/inbox/i12-delegate-approvals-modal.png)

**Delegate my approvals** picks a colleague and a **From / To** date range. While you are away, that person can approve the leave requests in your queue (**Save cover**).

---

## Part D: Resolving attendance alerts

### D1. An attendance alert ticket

![Attendance alert](screenshots/inbox/i23-attendance-alert-ticket-details.png)

**Nadesh Coomaraswamy**'s chat holds his whole attendance history as tickets: *Late clock-in* and *Early clock-out* alerts (each with **Resolve**), *Sick Leave* requests (Closed) and green *Sick Leave approved* result cards.

The selected alert's **Ticket details** show **Attendance details** (*Scheduled start 9:00 AM, Actual clock-in 9:20 AM, Delay 20 min*), the current **Outcome** (*Confirmed: keep counting it*) and the steps (*Detected → Waiting for review*).

### D2. Resolve an alert

![Alert resolve](screenshots/inbox/i24-attendance-alert-resolve-dialog.png)

The same outcome dialog as exception cases: **No issue – clear it** or **Real issue – keep on record**, with an optional note.

### D3. A closed leave ticket

![Closed leave](screenshots/inbox/i25-closed-leave-ticket.png)

Clicking a closed *Sick Leave* card shows the full record: **Approved** chip, **Request details** (leave type, date, duration, requested on, approved on), **Description / note** (the employee's note) and steps (*Submitted → Approved · Dapi Owner → Leave approved*).

---

## Part E: Chatting and organising

### E1. Message options

![Message options](screenshots/inbox/i27-chat-message-options.png)

Hovering a chat message shows **Reply**, a **reaction** (emoji) button and **⋯**, which offers **Forward** and **Delete for me**. The composer supports formatting (headings, bold, lists, checklists, links, images), emoji and attachments (**+**). Type **/** for commands.

### E2. Start a new group

![New group](screenshots/inbox/i13-new-group-dialog.png)

The **+** next to *Groups* creates a free group chat: **Group name** (e.g. *Payroll review*), pick **People**, then **Create group**.

---

## Use-case summary

| # | Use case | Where | Steps |
|---|----------|-------|-------|
| 1 | See what is waiting on me | Inbox home / Pending | Sidebar badge → Pending → filter by type |
| 2 | Approve extra hours for a module | DM → *Change allocated hours* | Open card → check details → (Edit hours) → Approve |
| 3 | Reject extra hours | DM → *Change allocated hours* | Reject → reason → Reject |
| 4 | Approve a task-creation request | DM → *Add new task* | Open card → (Edit title/priority/hours) → Approve |
| 5 | Resolve an identity-verification exception | Groups → case | Review evidence → Resolve → choose outcome → note |
| 6 | Resolve a late clock-in / early clock-out | Employee's DM | Open alert → check delay → Resolve → outcome |
| 7 | Review an employee's month | DM → *October 2026* tab | Scan Open / Resolved / Rejected, change month |
| 8 | Bring others into a ticket | Card ⋮ / header icon | Start a group, Add member, or Forward |
| 9 | Hand over approvals while away | Header ⋯ → Delegate | Pick person + dates → Save cover |
| 10 | Audit my past decisions | Header ⋯ → History | Read the decision list |
| 11 | Undo a wrong decision | Ticket details → Undo bar | Undo within 30 minutes → Revert → request reopens as Pending |

---

## Screenshot index

| File | Screen |
|------|--------|
| `i01-inbox-home.png` | Inbox home |
| `i02-inbox-pending-filter.png` | Pending filter |
| `i02b-pending-type-filter.png` | Pending type dropdown |
| `i03-inbox-search.png` | Search people and chats |
| `i28-notification-bell.png` | Notification bell |
| `i15-dm-work-approvals.png` | DM with Work approvals + month view |
| `i16-work-approval-ticket-details.png` | Change allocated hours details |
| `i17-work-approval-edit-before-approve.png` | Edit before approve |
| `i18-reject-reason-dialog.png` | Reject dialog |
| `i19-task-creation-ticket-details.png` | Add new task details |
| `i20-work-card-options-menu.png` | Work card menu |
| `i29-after-approve-revert-window.png` | After Approve + Undo bar |
| `i30-undo-confirm.png` | Revert this decision? |
| `i31-reject-with-reason-filled.png` | Reject with reason |
| `i32-after-reject.png` | After Reject |
| `i33-chat-after-decisions.png` | Chat with result cards |
| `i34-history-with-decisions.png` | History with decisions |
| `i26-closed-project-ticket.png` | Older closed (rejected) work ticket |
| `i04-exception-case-group.png` | Exception case group |
| `i05-resolve-outcome-dialog.png` | Resolve outcome dialog |
| `i06-case-options-menu.png` | Case card menu |
| `i08-add-people-dialog.png` | Add member |
| `i09-forward-dialog.png` | Forward dialog |
| `i07-chat-header-options.png` | Chat header menu |
| `i10-members-panel.png` | Members |
| `i11-history-panel.png` | History |
| `i12-delegate-approvals-modal.png` | Delegate my approvals |
| `i23-attendance-alert-ticket-details.png` | Attendance alert details (full chat) |
| `i24-attendance-alert-resolve-dialog.png` | Alert resolve dialog |
| `i25-closed-leave-ticket.png` | Closed leave ticket |
| `i27-chat-message-options.png` | Message options |
| `i13-new-group-dialog.png` | New group |

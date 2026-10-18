# Administer a standalone deployment

English | [中文](standalone-administration.zh.md)

This guide is for the administrator of a deployment on your own servers — the `enterprise` profile, installed for you by whoever set it up. It covers what has to exist before the server will start, how the first administrator signs in, and how to connect your corporate directory afterwards without editing a file again.

A deployment on your own hardware serves your own staff: it has accounts and no credit metering. Balances, allowances, and per-person quotas belong to the hosted service and are absent here, not set to zero.

## Before the first start: name your people

The accounts module ships no roster. A deployment that serves named people must say who they are, and nothing invents that for you, so the server refuses to start until the profile's `cordis.patch.yml` names at least one person:

```yaml
- id: people
  name: '@lyness/lyn-people/static'
  config:
    people:
      - id: ada
        displayName: Ada
        role: platform-administrator
      - id: bea
        displayName: Bea
        role: member
```

Three roles exist. A `platform-administrator` administers the whole deployment. A `tenant-administrator` administers one organization and names it with an `organization:` field. A `member` administers nothing. On a standalone deployment the people who run it are platform administrators.

The `id` is permanent: it is what sessions, grants, and sign-in bindings are written against. Pick something stable, such as an employee number or an account name, rather than a display name.

## Before the first start: admit the first administrator

Signing in has two halves. A **channel** authenticates somebody against a directory — WeCom, DingTalk, or Feishu. An **admission binding** says which person in your roster that directory identity is. An empty binding list admits nobody, which is deliberate: connecting a directory must not, by itself, let everyone in it sign in.

The first administrator cannot configure anything before signing in, so their channel and their binding are written in the profile once:

```yaml
- id: sign-in-kind-wecom-head-office
  name: '@lyness/lyn-wecom'
  config:
    corpId: ww-your-corp-id
    agentId: '1000002'
    secret: WECOM_APP_SECRET

- id: sign-in-admission
  name: '@lyness/lyn-sign-in/admission-roster'
  config:
    bindings:
      - channel: wecom
        issuer: ww-your-corp-id
        subject: ada-wecom-userid
        person: ada
```

`secret` names a credential reference, never the secret itself; the value is stored with `lyn credentials set WECOM_APP_SECRET`. The `issuer` and `subject` are what the directory reports: for WeCom the corp id and the member's UserId, for DingTalk the corp id and the person's unionId, for Feishu the tenant key and the union id. Your directory's own console shows them.

Start the server once this exists. The administrator opens the sign-in screen, chooses the button, and lands in the product.

## Afterwards: configure channels from the UI

Everything else happens in **Settings → Sign-in**, with no file editing and no restart.

The page lists the channels this deployment serves and offers a form to add one. Pick the directory, name the button, fill in the settings that directory needs — WeCom takes a corpid and an agentid, DingTalk an AppKey, Feishu an App ID — and type the application secret. Saving stores the secret in the credential store, mounts the channel, and the sign-in screen offers it immediately.

Each row says whether the channel is **serving**. A row that reads **not serving** is stored but not mounted: the deployment mounts no plugin for that kind, or that kind refused the settings. Correct the settings and save again; the record is kept so nothing has to be retyped.

Each row also shows a **channel id**. That id is what an admission binding names the channel by — a channel added from the UI gets its own id, so a binding written for it admits nobody through any other channel, including another one of the same kind.

### Add the rest of your staff

Adding a person is still two edits to the profile today: a row in the roster, and a binding naming their directory identity. The sign-in page is runtime-configurable; the roster is not yet. Plan for this when you add staff in batches.

### Rotate a secret

Edit the channel, type the new secret, and save. Leaving the secret field empty keeps the stored one, so renaming a channel never means retyping a secret nobody can read back. There is no second slot: for a moment one secret or the other is in force, so rotate when the directory has accepted the new one.

### Remove a channel

Removing a channel ends the way in for everybody who signed in through it and deletes its application secret. The page asks for an acknowledgement before it does either. Bindings written for that channel stay in the profile and admit nobody, because no channel reports that id any more.

## Who can do what

Configuring channels requires an administrator's standing. A member who opens the page reads that only an administrator can configure sign-in, and sees nothing else. A tenant administrator — on a deployment that has organizations — configures only their own organization's channels, and the deployment-wide ones stay out of reach.

## Continue

- [Configure models](./providers.md)
- [Use the Web UI](./index.md)

---
description: is to help sync code to the server continuously
---

# NGI-SYNC

## **Introduction**

**What is this tool made for?**

My experience: This really helps me when working on hosts like vps, wsl and docker environments. With the tight ram limitations I should be able to work productively. Using vscode remotely to the host target it will eat up ram on the host. Because the vscode-server will work to host in full, and here it is the problem. I made this tool so that my environment remains on windows and I just sync my code to host with ssh.

How about debugging?: I rarely use debugging tools on vscode. Just use the console on the host :\)

Still connect ssh manually? hmm :\( Actually, yes. But I have created a feature ssh direct connect note, for easy to connect ssh just call "ngi-sync direct" and choose where you will connect from your ssh config note.  


```bash
donny@DESKTOP-T36N2AT MINGW64 /d/workspaces_virtualbox
$ ngi-sync
You are in: D:\workspaces_virtualbox
Initialize Bootstrap Is Done!
[ undefined, undefined ]
? Direct Access List : (Press <enter> to submit)
> Running devsync2
  Start Gobetween
  Enter Virtualbox
  Enter docker Mysql database
  console :: Open Console
  devsync2 :: Open Devsync2
  clean :: Git clean up : git add --renormalize . && git reset
(Move up and down to reveal more choices)
```

Here's why:

{% hint style="info" %}
`Because this <"For my case typescript-javascript|PHP Intelephense as main extensions"> my vscode linting keeps still in use on my local and the code after save will sync to server automatically and compiler run on server will respond to code change.`
{% endhint %}




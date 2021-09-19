---
description: sync-config configuration
---

# Configuration

### **`project_name : <String>`**

This config for project identity

Example :

```yaml
project_name: Sample Project
```

### **`username : <String>`**

The username for ssh connect to the server

Example : 

```yaml
username: root
```

### **`privateKey : <String>`**

Place your private key as an absolute path.

Example :

```yaml
privateKey: C:\Users\test\.ssh\id_rsa
```

### **`host : <String>`**

Fill your host target

Example : 

```yaml
host: 192.168.0.2
```

### **`port : <String>`**

Fill the ssh port host target

Example : 

```yaml
port: 22
```

### **`localPath : <String>`**

Place your local project directory

Example :****

```yaml
localPath : D:\workspace\sample_project
```

### **`remotePath : <String>`**

Place your remote project directory

Example :

```yaml
remotePath : /root/workspaces/sample_project
```

### **`ignores : <ArrayString>`**

Select which file or folder you need to ignore to sync. 

Example : 

```yaml
ignores : 
 # if you want ignore folder add “/” for last character
 - dist/
 - .git/
 - node_modules/
 # if you want ignore only file
 - readme.md
```

{% hint style="info" %}
Note : You can define it on .sync\_ignore file too
{% endhint %}

### **`downloads : <ArrayString>`**

Select which file or folder you need exclusively can be downloaded. This feature is used for two way sync for specific file or folder.

Example : 

```yaml
downloads : 
 # if you want download folder add "/" for last character
 - storage/logs/
 - dist/
 # if you want download only file
 - readme.md
```

### **`single_sync : <ArrayString>`**

Select which file or folder you need exclusively can be downloaded and uploaded manually. This feature is used for simple rsync for specific files or folders.

Example :

```yaml
single_sync:
  - node_modules
  - dist
```

### **`trigger_permission : <ArrayObject>`**

This feature is used for managing CUD \(Create, Update, Delete\)  action sync to the server which is allowed or not.

Example : 

```yaml
trigger_permission:
  # it mean your delete folder action is not effect on the server
  unlink_folder: false
  # it mean your delete file action is not effect on the server
  unlink: false
  change: true
  add: true
```

### **`direct_access : <ArrayObject>`**

This external command that you can use for everyday use when you work. This includes the ssh\_config format too that you can use to create ssh connections with proxy.

Example :

```yaml
direct_access:
  config_file: ""
  # This config will save to ssh_config file on your ssh folder
  ssh_configs:
    - Host: sample_project_connection
      HostName: =host
      User: =username
      Port: =port
      RequestTty: force
      IdentityFile: =privateKey
      StrictHostKeyChecking: no
      RemoteCommand: cd =remotePath && bash -l
      ServerAliveInterval: 300
      ServerAliveCountMax: 2
  ssh_commands:
    # This command for use create folder project on server first
    - access_name: Create folder on server
      command: ssh -v -o RemoteCommand=none sample_project_connection -t mkdir =remotePath
    # This command for enter to the server and go to project folder
    - access_name: Enter to Server
      command: ssh -v -o RemoteCommand=none sample_project_connection
```

### **`size_limit : <Number>`**

You can limit size sync file upload to the server if more than size\_limit is blocked.

Example : 

```yaml
size_limit : 20 # this use Mb unit size
```

### **`reset_cache: <Boolean>`**

Every run ngi-sync devsync the file will store in cache if it gets changed. For comparing the cache file with the new file change similar or not. If similar, the file avoids uploading. You can set false if will not reset cache every run ngi-sync devsync, default is true.

Example :

```yaml
reset_cache: true
```

   



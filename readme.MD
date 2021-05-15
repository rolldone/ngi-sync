# Base information
ngi-sync is to help sync code to the server continuously

### Tasks
- [x] Add feature send command to both target and local.
- [x] Add feature pull syncronize.
- [x] Add feature sftp to sync by file opened.
- [x] Support ssh jump for multiple node ssh.
- [ ] Add feature force sync publish your data to target use rsync.
- [ ] Add feature force sync download target data to your local machine.

### Sample config
```
sync-config.json
{
    "username": "root",
    "privateKey": "C:/Users/test/Documents/private_key/openssh_nopassword.key",
    "host": "localhost",
    "port": "22",
    "localPath": "D:/workspace/your_project",
    "remotePath": "/home/ubuntu/workspaces/your_project",
    "ignores" : ["storage/logs","storage/app"],
    "downloads":["tool/test.exe","app/basic"],
    "jumps": [
        {
            "host": "localhost",
            "port": 22222,
            "username": "root",
            "privateKey": "C:/Users/test/Documents/private_key/openssh_nopassword.key"
        },
        {
            "host": "host2",
            "port": 22,
            "username": "root",
            "privateKey": "C:/Users/test/Documents/private_key/openssh_nopassword.key"
        }
    ]
}
```

# Still development!!
- Write good documentation for this project "on progress"
- Use this tool to help work on real project "on progress"

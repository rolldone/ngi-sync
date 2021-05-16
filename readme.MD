# Base information
ngi-sync is to help sync code to the server continuously

### Tasks
- [x] Add feature clone directory on local only
- [x] Add feature send command to both ssh and local.
- [x] Add feature sftp pull syncronize.
- [x] Add feature sftp push and watch file by action.
- [x] Support ssh jump for multiple server.
- [ ] Add feature backup sync publish your data to target use rsync.
- [ ] Add feature backup sync download target data to your local machine use rsync.

### Sample config
```
sync-config.json
{
    "mode": "local|ssh",
    "username": "root",
    "privateKey": "openssh_nopassword.key",
    "host": "localhost",
    "port": "2222",
    "localPath": "D:\\workspace\\ngsync\\storage_test",
    "remotePath": "\\\\wsl$\\Ubuntu-20.04\\home\\ubuntu\\workspaces\\test",
    "downloads": [
        ".ssh","logs"
    ],
    "jumps": [],
    "backup": {
        "schedule": {
            "loop": "1M|4W|1W|1D|4H|2H|1H|M30|M15|M5|timeout|once",
            "delay": "100000"
        },
        "rules": [
            {
                "command": {
                    "target": "local|remote",
                    "prompt": "ls -a -l"
                }
            },
            {
                "copy": {
                    "from": "",
                    "to": "",
                    "includes": [],
                    "excludes": []
                }
            },
            {
                "copy": {
                    "from": "",
                    "to": "",
                    "includes": [],
                    "excludes": []
                }
            }
        ]
    }
}
```

# Still development!!
- Write good documentation for this project "on progress"
- Use this tool to help work on real project "on progress"

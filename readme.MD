# Base information
ngi-sync is to help sync code to the server continuously

More info check [wiki](https://github.com/rolldone/ngi-sync/wiki)

### Tasks
- [x] Add feature clone directory on local only
- [x] Add feature send command to both ssh and local.
- [x] Add feature sftp pull syncronize.
- [x] Add feature sftp push and watch file by action.
- [x] Support ssh jump for multiple server.
- [x] Add feature instant open ssh new terminal
- [x] Add feature update config with own config on tool to ~/.ssh/config 

### Sample config
```
sync-config.json
{
    "project_name": "ngisync",
    "mode": "ssh",
    "username": "root",
    "privateKey": "D:\\workspace\\ngsync\\id_rsa_no_password",
    "host": "localhost",
    "port": "2222",
    "localPath": "D:\\workspace\\ngsync\\dist_2",
    "remotePath": "/root/ngsync/dist",
    "ignores": [
        "bin/",
        "storage_test/test.d.ts",
        ".ssh/"
    ],
    "downloads": [
        "logs/",
        "study/JumpRsync.d.ts"
    ],
    "jumps": [],
    "direct_access": {
        "config_file" : "C:\\Users\\test\\.ssh\\config",
        "ssh_configs" : [
            {
                "Host": "wsl_as_jump_rollproject",
                "HostName": "127.0.0.1",
                "User": "root",
                "Port": "2200",
                "IdentityFile" : "C:\\Users\\test\\.ssh\\id_rsa",
                "ProxyCommand" : "ssh -v to_rollproject nc localhost 22",
                "StrictHostKeyChecking" : "no"
              },
              {
                "Host": "wsl_as_jump_rollproject_request_remote",
                "HostName": "localhost",
                "User": "root",
                "Port": "2222",
                "RequestTty":"force",
                "IdentityFile" : "C:/Users/donny/.ssh/openssh_nopassword.key",
                "StrictHostKeyChecking" : "no",
                "RemoteCommand" : "cd /root/workspaces/artywiz_broadcast_service && bash -l"
              },
              {
                "Host": "to_rollproject",
                "HostName": "192.168.100.100",
                "User": "root",
                "Port": "22"
              },
              {
                "Host": "wsl",
                "HostName": "artywiz.local",
                "User": "root",
                "Port": "2200",
                "IdentityFile" : "C:\\Users\\test\\.ssh\\id_rsa",
                "StrictHostKeyChecking" : "no"
              },
              {
                "Host": "wsl_as_jump_openssh_server",
                "HostName": "localhost",
                "User": "root",
                "Port": "2200",
                "IdentityFile" : "C:\\Users\\test\\.ssh\\id_rsa",
                "ProxyCommand" : "ssh -v openssh_server -W %h:22",
                "StrictHostKeyChecking" : "no"
              },
              {
                "Host": "openssh_server",
                "HostName": "localhost",
                "User": "root",
                "Port": "2222"
              }
        ],
        "ssh_commands" : [
            {
                "access_name" : "WSL Only",
                "command" : "ssh root@localhost -p 2200 docker container ps"
            },
            {
                "access_name" : "WSL as Jump OpenSSH Server Docker",
                "command" : "ssh -v wsl_as_jump_openssh_server"
            },
            {
                "access_name" : "WSL as Jump Rollproject",
                "command" : "ssh -v wsl_as_jump_rollproject -t docker exec -it astrabpkb_web_1 bash"
            }
        ]
    },
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

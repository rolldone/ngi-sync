import InitCliService, { CliInterface as InitCliInterface} from "@root/app/init/services/CliService";

export interface CliInterface extends InitCliInterface{

}

const CliService = InitCliService.extend<CliInterface>({
    
});

export default CliService;

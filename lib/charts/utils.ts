import * as eks from '@aws-cdk/aws-eks';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import request from 'sync-request';

export function readYamlDocument(path: string): string {
    try {
        const doc = fs.readFileSync(path, 'utf8');
        return doc;
    } catch (e) {
        console.log(e + ' for path: ' + path);
        throw e;
    }
}

export function loadYaml(document: string): any {
    return yaml.load(document);
}

export function loadExternalYaml(url: string): any[] {
    return yaml.loadAll(request('GET', url).getBody().toString());
}

export function serializeYaml(document: any): string {
    return yaml.dump(document);
}

export function createNamespace(name: string, cluster: eks.ICluster): eks.KubernetesManifest {
    const resource = cluster.addManifest(`${name}Namespace`, {
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
            name: name
        }
    });

    return resource;
}

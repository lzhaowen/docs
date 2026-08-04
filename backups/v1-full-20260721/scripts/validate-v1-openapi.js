'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const english = JSON.parse(fs.readFileSync(path.join(rootDir, 'openapi.json'), 'utf8'));
const chinese = JSON.parse(fs.readFileSync(path.join(rootDir, 'openapi.zh.json'), 'utf8'));
const docsConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'docs.json'), 'utf8'));

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function resolveRef(spec, ref) {
    return ref
        .slice(2)
        .split('/')
        .reduce((value, key) => value && value[key], spec);
}

function collectOperations(spec) {
    const operations = [];
    for (const [route, pathItem] of Object.entries(spec.paths)) {
        for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
            if (pathItem[method]) {
                operations.push(`${method.toUpperCase()} ${route}`);
            }
        }
    }
    return operations;
}

function collectRefs(value, refs = []) {
    if (!value || typeof value !== 'object') {
        return refs;
    }
    if (typeof value.$ref === 'string') {
        refs.push(value.$ref);
    }
    for (const child of Object.values(value)) {
        collectRefs(child, refs);
    }
    return refs;
}

function collectMessageValues(value, values = []) {
    if (!value || typeof value !== 'object') {
        return values;
    }
    for (const [key, child] of Object.entries(value)) {
        if (key === 'message' && typeof child === 'string') {
            values.push(child);
        }
        collectMessageValues(child, values);
    }
    return values;
}

function collectDescriptions(value, values = []) {
    if (!value || typeof value !== 'object') {
        return values;
    }
    for (const [key, child] of Object.entries(value)) {
        if (key === 'description' && typeof child === 'string') {
            values.push(child);
        }
        collectDescriptions(child, values);
    }
    return values;
}

function validateSpec(spec, label) {
    const operations = collectOperations(spec);
    const serialized = JSON.stringify(spec);
    const schemas = spec.components.schemas;

    assert(Object.keys(spec.paths).length === 15, `${label}: expected 15 v1 paths`);
    assert(!operations.some((operation) => operation.startsWith('DELETE ')), `${label}: DELETE operation found`);
    assert(!spec.paths['/openapi/v1/rate-limits'], `${label}: rate-limits endpoint found`);
    assert(!spec.paths['/openapi/v1/files/convert'], `${label}: generic file conversion endpoint found`);
    assert(spec.paths['/openapi/v1/3dmodels/{id}/convert']?.post, `${label}: 3D conversion endpoint missing`);
    assert(spec.paths['/openapi/v1/3dmodels/{id}/files']?.get, `${label}: 3D file URL endpoint missing`);
    assert(spec.paths['/openapi/v1/files']?.post, `${label}: managed file creation endpoint missing`);
    assert(spec.paths['/openapi/v1/files']?.get, `${label}: managed file list endpoint missing`);
    assert(spec.paths['/openapi/v1/files/{id}']?.get, `${label}: managed file retrieval endpoint missing`);
    assert(spec.paths['/openapi/v1/credits']?.get, `${label}: credits endpoint missing`);
    assert(!spec.paths['/openapi/v1/balance'], `${label}: legacy balance endpoint found`);
    assert(!serialized.includes('"input":'), `${label}: input response field found`);
    assert(!serialized.includes('"output":'), `${label}: output response field found`);
    assert(!serialized.includes('"created":'), `${label}: created timestamp field found`);
    assert(spec.components.securitySchemes.bearerAuth.type === 'http', `${label}: Authorization scheme must be http`);
    assert(spec.components.securitySchemes.bearerAuth.scheme === 'bearer', `${label}: Authorization scheme must be bearer`);
    assert(
        spec.components.securitySchemes.bearerAuth['x-default'] === '${YOUR_API_KEY}',
        `${label}: Authorization placeholder mismatch`
    );
    assert(
        JSON.stringify(spec.security) === JSON.stringify([{ bearerAuth: [] }]),
        `${label}: root bearer security requirement missing`
    );
    assert(!spec.components.parameters?.AuthorizationHeader, `${label}: legacy Authorization header parameter found`);
    for (const operation of operations) {
        const [method, route] = operation.split(' ');
        const operationObject = spec.paths[route][method.toLowerCase()];
        assert(
            !operationObject.parameters?.some((parameter) => parameter.$ref === '#/components/parameters/AuthorizationHeader'
                || String(parameter.name || '').toLowerCase() === 'authorization'),
            `${label}: ${operation} must use the OpenAPI bearer security scheme`
        );
        assert(!operationObject['x-codeSamples'], `${label}: ${operation} should use Mintlify autogeneration`);
    }
    assert(!serialized.includes('google/veo-3.1'), `${label}: Veo model found`);
    assert(!serialized.includes('multiview-to-3d'), `${label}: multiview mode found`);
    assert(!serialized.toLowerCase().includes('retopo'), `${label}: retopo wording found`);
    assert(!serialized.includes('"stp"'), `${label}: STP format found`);
    assert(!serialized.toLowerCase().includes('local image'), `${label}: local image wording found`);
    assert(!serialized.includes('#/components/headers/XRateLimit'), `${label}: legacy rate-limit header reference found`);
    for (const headerName of [
        'RateLimitLimitRequests',
        'RateLimitRemainingRequests',
        'RateLimitResetRequests'
    ]) {
        assert(spec.components.headers[headerName], `${label}: ${headerName} missing`);
    }

    for (const route of [
        '/openapi/v1/images/generations',
        '/openapi/v1/videos/generations',
        '/openapi/v1/3dmodels/generations'
    ]) {
        const content = spec.paths[route].post.requestBody.content;
        assert(Object.keys(content).join(',') === 'application/json', `${label}: ${route} must be JSON-only`);
    }
    const fileUploadContent = spec.paths['/openapi/v1/files'].post.requestBody.content;
    assert(
        Object.keys(fileUploadContent).join(',') === 'multipart/form-data',
        `${label}: managed file creation must be multipart-only`
    );

    for (const schemaName of ['ImageGenerationJsonRequest', 'VideoGenerationJsonRequest']) {
        const schema = schemas[schemaName];
        assert(schema.properties.resolution, `${label}: ${schemaName}.resolution missing`);
        assert(schema.properties.size, `${label}: ${schemaName}.size missing`);
        assert(
            JSON.stringify(schema.not?.required) === JSON.stringify(['resolution', 'size']),
            `${label}: ${schemaName} resolution/size mutex missing`
        );
        assert(schema.properties.images?.items?.$ref === '#/components/schemas/FileReference', `${label}: ${schemaName} file reference missing`);
        assert(schema.properties.extra_body?.$ref === '#/components/schemas/ExtraBody', `${label}: ${schemaName}.extra_body missing`);
        assert(!schema.properties.model.enum, `${label}: ${schemaName}.model enum must be dynamic`);
    }
    assert(
        JSON.stringify(schemas.ImageGenerationJsonRequest.properties.resolution.enum) === JSON.stringify(['1K', '2K']),
        `${label}: current image resolution enum mismatch`
    );
    assert(
        JSON.stringify(schemas.VideoGenerationJsonRequest.properties.resolution.enum) === JSON.stringify(['480p', '720p', '1080p', '1K', '2K']),
        `${label}: current video resolution enum mismatch`
    );

    const threeDFields = Object.keys(schemas.ThreeDGenerationRequest.properties);
    for (const field of ['mode', 'user', 'mesh_type', 'init_pose']) {
        assert(!threeDFields.includes(field), `${label}: ThreeDGenerationRequest.${field} found`);
    }
    for (const field of ['target_polycount', 'art_style']) {
        assert(threeDFields.includes(field), `${label}: ThreeDGenerationRequest.${field} missing`);
    }
    assert(
        JSON.stringify(schemas.ThreeDGenerationRequest.properties.mesh_quality.enum) === JSON.stringify(['standard', 'high', 'extra_high']),
        `${label}: current 3D mesh_quality enum mismatch`
    );
    assert(schemas.ThreeDGenerationRequest.properties.images.maxItems === 1, `${label}: 3D image limit must be one`);
    assert(!schemas.Model.properties.id.enum, `${label}: model registry IDs must be dynamic`);
    assert(schemas.Model.properties.created_at, `${label}: Model.created_at missing`);
    assert(schemas.Model.properties.updated_at, `${label}: Model.updated_at missing`);
    assert(!schemas.Model.properties.created, `${label}: Model.created must not be used`);
    assert(schemas.Model.properties.supported_parameters, `${label}: model supported_parameters missing`);
    assert(schemas.Model.properties.default_parameters, `${label}: model default_parameters missing`);
    const modelExample = spec.paths['/openapi/v1/models'].get.responses['200'].content['application/json'].example;
    assert(modelExample.data.length >= 4, `${label}: current model examples missing`);
    assert(
        modelExample.data.every((model) => model.supported_parameters.length > 0),
        `${label}: current supported model parameters missing`
    );
    assert(schemas.Task.properties.progress, `${label}: task progress missing`);
    assert(schemas.Task.properties.result, `${label}: asynchronous task result missing`);
    assert(!schemas.Task.properties.input, `${label}: Task.input must not be exposed`);
    assert(!schemas.Task.properties.output, `${label}: Task.output must not be exposed`);
    assert(schemas.TaskReceipt, `${label}: TaskReceipt missing`);
    assert(!schemas.TaskReceipt.properties.result, `${label}: TaskReceipt.result must not be exposed`);
    assert(
        schemas.TaskList.properties.data.items.$ref === '#/components/schemas/TaskReceipt',
        `${label}: TaskList must use TaskReceipt`
    );
    for (const route of [
        '/openapi/v1/images/generations',
        '/openapi/v1/videos/generations',
        '/openapi/v1/3dmodels/generations',
        '/openapi/v1/3dmodels/refine',
        '/openapi/v1/3dmodels/texture',
        '/openapi/v1/3dmodels/pbr',
        '/openapi/v1/3dmodels/remesh',
        '/openapi/v1/3dmodels/{id}/convert'
    ]) {
        assert(
            spec.paths[route].post.responses['202'].content['application/json'].schema.$ref === '#/components/schemas/TaskList',
            `${label}: ${route} must return TaskList without result`
        );
    }
    assert(
        spec.paths['/openapi/v1/tasks/{id}'].get.responses['200'].content['application/json'].example.progress === 100,
        `${label}: completed task progress example missing`
    );
    assert(Object.keys(schemas.TaskUsage.properties).join(',') === 'credits', `${label}: task usage must contain credits only`);
    assert(!schemas.UsageList.properties.total_cost, `${label}: usage amount field found`);
    assert(schemas.ExtraBody.maxProperties > 0, `${label}: extra_body property limit missing`);
    assert(/validated/i.test(schemas.ExtraBody.description) || label === 'zh', `${label}: extra_body security description missing`);

    const fileReference = schemas.FileReference.oneOf.map((item) => item.$ref).sort();
    assert(
        JSON.stringify(fileReference) === JSON.stringify([
            '#/components/schemas/FileReferenceKey',
            '#/components/schemas/FileReferenceUrl'
        ]),
        `${label}: FileReference must contain URL and fileKey variants`
    );
    assert(/validated|checked/i.test(schemas.FileReferenceUrl.properties.url.description) || label === 'zh', `${label}: URL validation description missing`);
    assert(schemas.FileReferenceUrl.properties.url.pattern === '^https://', `${label}: HTTPS URL pattern missing`);
    assert(
        schemas.CreateManagedFileRequest.properties.file.format === 'binary',
        `${label}: managed file binary upload missing`
    );
    assert(
        JSON.stringify(schemas.CreateManagedFileRequest.required) === JSON.stringify(['file']),
        `${label}: managed file requirement mismatch`
    );
    assert(!schemas.CreateManagedFileRequest.properties.purpose, `${label}: CreateManagedFileRequest.purpose found`);
    assert(!schemas.ManagedFile.properties.purpose, `${label}: ManagedFile.purpose found`);
    assert(
        !(spec.paths['/openapi/v1/files'].get.parameters || []).some((parameter) => parameter.name === 'purpose'),
        `${label}: file list purpose query found`
    );
    assert(!/purpose/i.test(serialized) && !serialized.includes('用途'), `${label}: file purpose wording found`);
    assert(schemas.ManagedFile.properties.updated_at, `${label}: ManagedFile.updated_at missing`);
    assert(schemas.ManagedFileList.properties.first_id, `${label}: ManagedFileList.first_id missing`);
    assert(schemas.ManagedFileList.properties.last_id, `${label}: ManagedFileList.last_id missing`);

    const imageExamples = spec.paths['/openapi/v1/images/generations'].post.requestBody.content['application/json'].examples;
    const videoExamples = spec.paths['/openapi/v1/videos/generations'].post.requestBody.content['application/json'].examples;
    const threeDExample = spec.paths['/openapi/v1/3dmodels/generations'].post.requestBody.content['application/json'].example;
    assert(imageExamples.named_resolution.value.images.some((image) => image.fileKey), `${label}: image fileKey example missing`);
    assert(imageExamples.named_resolution.value.images.some((image) => image.url), `${label}: image URL example missing`);
    assert(imageExamples.pixel_size.value.size, `${label}: image pixel size example missing`);
    assert(videoExamples.named_resolution.value.images.some((image) => image.url), `${label}: video URL example missing`);
    assert(videoExamples.pixel_size.value.images.some((image) => image.fileKey), `${label}: video fileKey example missing`);
    assert(videoExamples.pixel_size.value.size, `${label}: video pixel size example missing`);
    assert(threeDExample.images.some((image) => image.fileKey || image.url), `${label}: 3D file reference example missing`);

    const descriptions = collectDescriptions(spec);
    assert(!descriptions.some((description) => /UUID/i.test(description)), `${label}: UUID wording found in a description`);
    assert(!descriptions.some((description) => /equivalent to the legacy/i.test(description)), `${label}: legacy equivalence wording found`);

    const convertFormats = schemas.Convert3DModelRequest.properties.target_format.enum;
    assert(!convertFormats.includes('stp'), `${label}: STP format found in conversion enum`);

    for (const ref of collectRefs(spec)) {
        assert(resolveRef(spec, ref), `${label}: unresolved reference ${ref}`);
    }
}

validateSpec(english, 'en');
validateSpec(chinese, 'zh');

assert(docsConfig.api.examples.autogenerate === true, 'Mintlify code sample autogeneration must remain enabled');
assert(
    JSON.stringify(docsConfig.api.examples.languages) === JSON.stringify([
        'curl',
        'python',
        'javascript',
        'typescript',
        'java',
        'go',
        'ruby',
        'php',
        'csharp'
    ]),
    'Mintlify code sample language list is incomplete'
);

assert(
    JSON.stringify(collectOperations(english)) === JSON.stringify(collectOperations(chinese)),
    'English and Chinese operation sets differ'
);
assert(
    JSON.stringify(collectMessageValues(english)) === JSON.stringify(collectMessageValues(chinese)),
    'Chinese response message values must match English'
);

console.log(`Validated ${Object.keys(english.paths).length} v1 paths in English and Chinese.`);

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
const ts = __importStar(require("typescript"));
const path_1 = require("path");
function join(...params) {
    /* istanbul ignore if  */
    if (path_1.sep === "\\") {
        const ret = path_1.join(...params);
        return ret.replace(/\\/g, "/");
    }
    /* istanbul ignore next  */
    return path_1.join(...params);
}
function camel2Dash(_str) {
    const str = _str[0].toLowerCase() + _str.substr(1);
    return str.replace(/([A-Z])/g, $1 => `-${$1.toLowerCase()}`);
}
function camel2Underline(_str) {
    const str = _str[0].toLowerCase() + _str.substr(1);
    return str.replace(/([A-Z])/g, $1 => `_${$1.toLowerCase()}`);
}
function getImportedStructs(node) {
    const structs = new Set();
    node.forEachChild((importChild) => {
        if (!ts.isImportClause(importChild)) {
            return;
        }
        // not allow default import, or mixed default and named import
        // e.g. import foo from 'bar'
        // e.g. import foo, { bar as baz } from 'x'
        // and must namedBindings exist
        if (importChild.name || !importChild.namedBindings) {
            return;
        }
        // not allow namespace import
        // e.g. import * as _ from 'lodash'
        if (!ts.isNamedImports(importChild.namedBindings)) {
            return;
        }
        importChild.namedBindings.forEachChild(namedBinding => {
            // ts.NamedImports.elements will always be ts.ImportSpecifier
            const importSpecifier = namedBinding;
            // import { foo } from 'bar'
            if (!importSpecifier.propertyName) {
                structs.add({ importName: importSpecifier.name.text });
                return;
            }
            // import { foo as bar } from 'baz'
            structs.add({
                importName: importSpecifier.propertyName.text,
                variableName: importSpecifier.name.text,
            });
        });
    });
    return structs;
}
function createDistAst(struct, options) {
    const astNodes = [];
    const { libraryName, libraryOverride } = options;
    const _importName = struct.importName;
    const importName = options.camel2UnderlineComponentName
        ? camel2Underline(_importName)
        : options.camel2DashComponentName
            ? camel2Dash(_importName)
            : _importName;
    const libraryDirectory = typeof options.libraryDirectory === "function"
        ? options.libraryDirectory(_importName)
        : join(options.libraryDirectory || "", importName);
    /* istanbul ignore next  */
    if (process.env.NODE_ENV !== "production" && libraryDirectory == null) {
        console.warn(`custom libraryDirectory resolve a ${libraryDirectory} path`);
    }
    const importPath = !libraryOverride ? join(libraryName, libraryDirectory) : libraryDirectory;
    let canResolveImportPath = true;
    try {
        require.resolve(importPath, {
            paths: [process.cwd(), ...options.resolveContext],
        });
    }
    catch (e) {
        canResolveImportPath = false;
        astNodes.push(ts.createImportDeclaration(undefined, undefined, ts.createImportClause(undefined, ts.createNamedImports([ts.createImportSpecifier(undefined, ts.createIdentifier(_importName))])), ts.createLiteral(libraryName)));
    }
    if (canResolveImportPath) {
        const scriptNode = ts.createImportDeclaration(undefined, undefined, ts.createImportClause(struct.variableName || !options.transformToDefaultImport ? undefined : ts.createIdentifier(struct.importName), struct.variableName
            ? ts.createNamedImports([
                ts.createImportSpecifier(options.transformToDefaultImport
                    ? ts.createIdentifier("default")
                    : ts.createIdentifier(struct.importName), ts.createIdentifier(struct.variableName)),
            ])
            : options.transformToDefaultImport
                ? undefined
                : ts.createNamedImports([ts.createImportSpecifier(undefined, ts.createIdentifier(struct.importName))])), ts.createLiteral(importPath));
        astNodes.push(scriptNode);
        if (options.style) {
            const { style } = options;
            let stylePath;
            if (typeof style === "function") {
                stylePath = style(importPath);
            }
            else {
                stylePath = `${importPath}/style/${style === true ? "index" : style}.js`;
            }
            if (stylePath) {
                const styleNode = ts.createImportDeclaration(undefined, undefined, undefined, ts.createLiteral(stylePath));
                astNodes.push(styleNode);
            }
        }
    }
    return astNodes;
}
const defaultOptions = {
    libraryName: "react-pearls",
    libraryDirectory: "lib",
    style: false,
    camel2DashComponentName: true,
    transformToDefaultImport: true,
    resolveContext: [""],
    libraryOverride: false,
};
module.exports = function (_options = {}) {
    const mergeDefault = (options) => (Object.assign(Object.assign({}, defaultOptions), options));
    const optionsArray = Array.isArray(_options)
        ? _options.map(options => mergeDefault(options))
        : [mergeDefault(_options)];
    return (context) => {
        const visitor = node => {
            if (ts.isSourceFile(node)) {
                return ts.visitEachChild(node, visitor, context);
            }
            if (!ts.isImportDeclaration(node)) {
                return node;
            }
            const importedLibName = node.moduleSpecifier.text;
            const options = optionsArray.find(_ => _.libraryName === importedLibName);
            if (!options) {
                return node;
            }
            const structs = getImportedStructs(node);
            if (structs.size === 0) {
                return node;
            }
            return Array.from(structs).reduce((acc, struct) => {
                const nodes = createDistAst(struct, options);
                return acc.concat(nodes);
            }, []);
        };
        return (node) => ts.visitNode(node, visitor);
    };
};

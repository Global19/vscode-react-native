import url = require("url");
import path = require("path");

interface ISourceMap {
    file: string;
    sources: string[];
    version: number;
    names: string[];
    mappings: string;
    sourceRoot?: string;
    sourcesContent?: string[];
}

export class SourceMapUtil {
    private static SourceMapURLRegex: RegExp = /\/\/(#|@) sourceMappingURL=(.+?)\s*$/m;

    /**
     * Given a script body and URL, this method parses the body and finds the corresponding source map URL.
     * If the source map URL is not found in the body in the expected form, null is returned.
     */
    public getSourceMapURL(scriptUrl: url.Url, scriptBody: string): url.Url {
        let result: url.Url = null;

        // scriptUrl = "http://localhost:8081/index.ios.bundle?platform=ios&dev=true"
        let sourceMappingRelativeUrl = this.getSourceMapRelativeUrl(scriptBody); // sourceMappingRelativeUrl = "/index.ios.map?platform=ios&dev=true"
        if (sourceMappingRelativeUrl) {
            let sourceMappingUrl = url.parse(sourceMappingRelativeUrl);
            sourceMappingUrl.protocol = scriptUrl.protocol;
            sourceMappingUrl.host = scriptUrl.host;
            // parse() repopulates all the properties of the URL
            result = url.parse(url.format(sourceMappingUrl));
        }

        return result;
    }

    /**
     * Updates the contents of a source map file to be VS Code friendly:
     * - makes source paths unix style and relative to the sources root path
     * - updates the url of the script file
     * - deletes the script content from the source map
     *
     * @parameter sourceMapBody - body of the source map as generated by the RN Packager.
     * @parameter scriptPath - path of the script file asssociated with this source map.
     * @parameter sourcesRootPath - root path of sources
     *
     */
    public updateSourceMapFile(sourceMapBody: string, scriptPath: string, sourcesRootPath: string): string {
        try {
            let sourceMap = <ISourceMap>JSON.parse(sourceMapBody);
            sourceMap.sources = sourceMap.sources.map(sourcePath => {
                return this.updateSourceMapPath(sourcePath, sourcesRootPath);
            });

            delete sourceMap.sourcesContent;
            sourceMap.sourceRoot = "";
            sourceMap.file = scriptPath;
            return JSON.stringify(sourceMap);
        } catch (exception) {
            return sourceMapBody;
        }
    }

    /**
     * Given an absolute source path, this method does two things:
     * 1. It changes the path from absolute to be relative to the sourcesRootPath parameter.
     * 2. It changes the path separators to Unix style.
     */
    private updateSourceMapPath(sourcePath: string, sourcesRootPath: string) {
        let relativeSourcePath = path.relative(sourcesRootPath, sourcePath);
        return this.makeUnixStylePath(relativeSourcePath);
    }

    /**
     * Visual Studio Code source mapping requires Unix style path separators.
     * This method replaces all back-slash characters in a given string with forward-slash ones.
     */
    private makeUnixStylePath(p: string): string {
        let pathArgs = p.split(path.sep);
        return path.posix.join.apply(null, pathArgs);
    }

    /**
     * Parses the body of a script searching for a source map URL.
     * It supports the following source map url styles:
     *  //# sourceMappingURL=path/to/source/map
     *  //@ sourceMappingURL=path/to/source/map
     *
     * Returns the first match if found, null otherwise.
     */
    private getSourceMapRelativeUrl(body: string) {
        let match = body.match(SourceMapUtil.SourceMapURLRegex);
        // If match is null, the body doesn't contain the source map
        return match ? match[2] : null;
    }

    /**
     * Updates source map URLs in the script body.
     */
    public updateScriptPaths(scriptBody: string, sourceMappingUrl: url.Url) {
        // Update the body with the new location of the source map on storage.
        return scriptBody.replace(SourceMapUtil.SourceMapURLRegex,
            "//# sourceMappingURL=" + path.basename(sourceMappingUrl.pathname));
    }
}
{
  description = "Development shell for message-mirror";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs, ... }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      forAllSystems =
        function:
        nixpkgs.lib.genAttrs supportedSystems (
          system:
          function {
            pkgs = import nixpkgs { inherit system; };
          }
        );
    in
    {
      packages = forAllSystems (
        { pkgs }:
        {
          default = pkgs.stdenv.mkDerivation (finalAttrs: {
            pname = "message-mirror";
            version = "0.0.0";

            src = self;

            nativeBuildInputs = with pkgs; [
              nodejs
              pnpm
              pnpmConfigHook
              typescript
              makeWrapper
            ];

            pnpmDeps = pkgs.fetchPnpmDeps {
              inherit (finalAttrs) pname version src;
              fetcherVersion = 4;
              hash = "sha256-Q8ks8eTErGjCNPZQovDyvs4EWe6cNJ6n7khX3AFaim0=";
            };

            buildPhase = ''
              runHook preBuild
              pnpm run build
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p $out/lib/message-mirror $out/bin
              cp -r dist package.json node_modules $out/lib/message-mirror/
              makeWrapper ${pkgs.nodejs}/bin/node $out/bin/message-mirror \
                --add-flags "$out/lib/message-mirror/dist/cli/main.js"
              runHook postInstall
            '';
          });
        }
      );

      devShells = forAllSystems (
        { pkgs }:
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              biome
              jq
              nodejs
              pnpm
              typescript
              typescript-language-server
            ];
          };
        }
      );
    };
}

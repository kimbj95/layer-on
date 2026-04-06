using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using ACadSharp;
using ACadSharp.IO;

class Program
{
    static int Main(string[] args)
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

        if (args.Length < 2)
        {
            PrintUsage();
            return 1;
        }

        string command = args[0];

        try
        {
            switch (command)
            {
                case "modify":
                    if (args.Length < 4)
                    {
                        Console.Error.WriteLine("Usage: DwgConverter modify <input.dwg> <output.dwg> <config.json>");
                        return 1;
                    }
                    ModifyDwg(args[1], args[2], args[3]);
                    break;
                case "list-layers":
                    ListLayers(args[1]);
                    break;
                case "to-dxf":
                    ConvertToDxf(args[1], args[2]);
                    Console.WriteLine($"OK: {args[1]} -> {args[2]}");
                    break;
                default:
                    Console.Error.WriteLine($"Unknown command: {command}");
                    return 1;
            }
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error: {ex.Message}");
            return 2;
        }
    }

    static void PrintUsage()
    {
        Console.Error.WriteLine("Usage:");
        Console.Error.WriteLine("  DwgConverter modify <input.dwg> <output.dwg> <config.json>");
        Console.Error.WriteLine("  DwgConverter list-layers <input.dwg>");
        Console.Error.WriteLine("  DwgConverter to-dxf <input.dwg> <output.dxf>");
    }

    // ── Production commands ──────────────────────────

    static void ModifyDwg(string inputPath, string outputPath, string configPath)
    {
        var configText = File.ReadAllText(configPath);
        var config = JsonSerializer.Deserialize<ModifyConfig>(configText)!;

        CadDocument doc;
        using (var reader = new DwgReader(inputPath))
            doc = reader.Read();

        int modified = 0;
        var hiddenSet = new HashSet<string>(config.HiddenLayers ?? Array.Empty<string>());

        foreach (var layer in doc.Layers)
        {
            // Apply ACI color
            if (config.Layers != null && config.Layers.TryGetValue(layer.Name, out var layerConfig))
            {
                if (layerConfig.AciColor.HasValue)
                {
                    layer.Color = new Color((short)layerConfig.AciColor.Value);
                    modified++;
                }
            }

            // Hide layer
            if (hiddenSet.Contains(layer.Name))
            {
                layer.IsOn = false;
            }
        }

        using (var writer = new DwgWriter(outputPath, doc))
            writer.Write();

        Console.WriteLine($"OK: Modified {modified} layers in {inputPath} -> {outputPath}");
    }

    static void ListLayers(string dwgPath)
    {
        CadDocument doc;
        using (var reader = new DwgReader(dwgPath))
            doc = reader.Read();

        var layers = new List<LayerEntry>();
        foreach (var layer in doc.Layers)
        {
            layers.Add(new LayerEntry
            {
                Name = layer.Name,
                AciColor = layer.Color.Index,
            });
        }

        var (_, totalEntities) = CountEntities(doc);

        var result = new ListLayersResult
        {
            Layers = layers,
            EntityCount = totalEntities,
        };

        var json = JsonSerializer.Serialize(result, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            WriteIndented = false,
        });
        Console.Write(json);
    }

    // ── Preview utility (DWG→DXF for geometry only) ──

    static void ConvertToDxf(string dwgPath, string dxfPath)
    {
        CadDocument doc;
        using (var reader = new DwgReader(dwgPath))
            doc = reader.Read();
        using (var writer = new DxfWriter(dxfPath, doc, false))
            writer.Write();
    }

    static (int direct, int total) CountEntities(CadDocument doc)
    {
        int direct = 0;
        int total = 0;
        foreach (var entity in doc.Entities)
        {
            direct++;
            total++;
        }
        foreach (var block in doc.BlockRecords)
        {
            foreach (var entity in block.Entities)
                total++;
        }
        return (direct, total);
    }
}

// ── JSON models ──────────────────────────────────

class ModifyConfig
{
    [JsonPropertyName("layers")]
    public Dictionary<string, LayerConfig>? Layers { get; set; }

    [JsonPropertyName("hidden_layers")]
    public string[]? HiddenLayers { get; set; }
}

class LayerConfig
{
    [JsonPropertyName("aci_color")]
    public int? AciColor { get; set; }
}

class LayerEntry
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("aci_color")]
    public short AciColor { get; set; }
}

class ListLayersResult
{
    [JsonPropertyName("layers")]
    public List<LayerEntry> Layers { get; set; } = new();

    [JsonPropertyName("entity_count")]
    public int EntityCount { get; set; }
}

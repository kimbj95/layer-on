using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using ACadSharp;
using ACadSharp.IO;
using ACadSharp.XData;

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
                case "modify-to-dxf":
                    if (args.Length < 4)
                    {
                        Console.Error.WriteLine("Usage: DwgConverter modify-to-dxf <input.dwg> <output.dxf> <config.json>");
                        return 1;
                    }
                    ModifyDwgToDxf(args[1], args[2], args[3]);
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
        Console.Error.WriteLine("  DwgConverter modify-to-dxf <input.dwg> <output.dxf> <config.json>");
        Console.Error.WriteLine("  DwgConverter list-layers <input.dwg>");
        Console.Error.WriteLine("  DwgConverter to-dxf <input.dwg> <output.dxf>");
    }

    // ── Core layer modification ─────────────────────

    static int ApplyConfig(CadDocument doc, ModifyConfig config, bool applyDescriptions)
    {
        int modified = 0;
        var hiddenSet = new HashSet<string>(config.HiddenLayers ?? Array.Empty<string>());

        foreach (var layer in doc.Layers)
        {
            if (config.Layers != null && config.Layers.TryGetValue(layer.Name, out var layerConfig))
            {
                if (layerConfig.AciColor.HasValue)
                {
                    layer.Color = new Color((short)layerConfig.AciColor.Value);
                    modified++;
                }

                if (applyDescriptions && !string.IsNullOrEmpty(layerConfig.Description))
                {
                    layer.Description = layerConfig.Description;

                    var xdata = new ExtendedData();
                    xdata.Records.Add(new ExtendedDataString(""));
                    xdata.Records.Add(new ExtendedDataString(layerConfig.Description));
                    layer.ExtendedData.Add("AcAecLayerStandard", xdata);
                }
            }

            if (hiddenSet.Contains(layer.Name))
            {
                layer.IsOn = false;
            }
        }

        // Apply renames last (collect first to avoid modifying dictionary during iteration)
        if (config.Renames != null && config.Renames.Count > 0)
        {
            var toRename = doc.Layers
                .Where(l => config.Renames.ContainsKey(l.Name))
                .ToList();
            foreach (var layer in toRename)
            {
                layer.Name = config.Renames[layer.Name];
            }
        }

        return modified;
    }

    // ── Production commands ──────────────────────────

    static void ModifyDwg(string inputPath, string outputPath, string configPath)
    {
        var config = JsonSerializer.Deserialize<ModifyConfig>(File.ReadAllText(configPath))!;

        CadDocument doc;
        using (var reader = new DwgReader(inputPath))
            doc = reader.Read();

        int modified = ApplyConfig(doc, config, applyDescriptions: false);

        using (var writer = new DwgWriter(outputPath, doc))
            writer.Write();

        Console.WriteLine($"OK: Modified {modified} layers in {inputPath} -> {outputPath}");
    }

    static void ModifyDwgToDxf(string inputPath, string outputPath, string configPath)
    {
        var config = JsonSerializer.Deserialize<ModifyConfig>(File.ReadAllText(configPath))!;

        CadDocument doc;
        using (var reader = new DwgReader(inputPath))
            doc = reader.Read();

        // Upgrade to AC1027+ for UTF-8 XDATA encoding (Korean descriptions)
        if (doc.Header.Version < ACadVersion.AC1027)
            doc.Header.Version = ACadVersion.AC1027;

        int modified = ApplyConfig(doc, config, applyDescriptions: true);

        using (var writer = new DxfWriter(outputPath, doc, false))
            writer.Write();

        Console.WriteLine($"OK: Modified {modified} layers, DWG->DXF {inputPath} -> {outputPath}");
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

        int total = 0;
        foreach (var entity in doc.Entities) total++;
        foreach (var block in doc.BlockRecords)
            foreach (var entity in block.Entities) total++;

        var result = new ListLayersResult
        {
            Layers = layers,
            EntityCount = total,
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
}

// ── JSON models ──────────────────────────────────

class ModifyConfig
{
    [JsonPropertyName("layers")]
    public Dictionary<string, LayerConfig>? Layers { get; set; }

    [JsonPropertyName("hidden_layers")]
    public string[]? HiddenLayers { get; set; }

    [JsonPropertyName("renames")]
    public Dictionary<string, string>? Renames { get; set; }
}

class LayerConfig
{
    [JsonPropertyName("aci_color")]
    public int? AciColor { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }
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

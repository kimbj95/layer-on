using System.Text;
using System.Text.Json;
using ACadSharp;
using ACadSharp.IO;

class Program
{
    static int Main(string[] args)
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

        if (args.Length < 2)
        {
            Console.Error.WriteLine("Usage:");
            Console.Error.WriteLine("  DwgConverter to-dxf <input.dwg> <output.dxf>");
            Console.Error.WriteLine("  DwgConverter to-dwg <input.dxf> <output.dwg>");
            Console.Error.WriteLine("  DwgConverter apply-colors <input.dwg> <output.dwg> <colors.json>");
            return 1;
        }

        string command = args[0];

        try
        {
            switch (command)
            {
                case "to-dxf":
                    ConvertToDxf(args[1], args[2]);
                    Console.WriteLine($"OK: {args[1]} -> {args[2]}");
                    break;
                case "to-dwg":
                    ConvertToDwg(args[1], args[2]);
                    Console.WriteLine($"OK: {args[1]} -> {args[2]}");
                    break;
                case "apply-colors":
                    if (args.Length < 4)
                    {
                        Console.Error.WriteLine("Usage: DwgConverter apply-colors <input.dwg> <output.dwg> <colors.json>");
                        return 1;
                    }
                    ApplyColors(args[1], args[2], args[3]);
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

    static void ConvertToDxf(string dwgPath, string dxfPath)
    {
        CadDocument doc;
        using (var reader = new DwgReader(dwgPath))
        {
            doc = reader.Read();
        }
        using (var writer = new DxfWriter(dxfPath, doc, false))
        {
            writer.Write();
        }
    }

    static void ConvertToDwg(string dxfPath, string dwgPath)
    {
        CadDocument doc;
        using (var reader = new DxfReader(dxfPath))
        {
            doc = reader.Read();
        }
        using (var writer = new DwgWriter(dwgPath, doc))
        {
            writer.Write();
        }
    }

    // Standard ACI colors for reliable mapping
    static readonly (short index, byte r, byte g, byte b)[] AciPalette = {
        (1, 255, 0, 0),       // Red
        (2, 255, 255, 0),     // Yellow
        (3, 0, 255, 0),       // Green
        (4, 0, 255, 255),     // Cyan
        (5, 0, 0, 255),       // Blue
        (6, 255, 0, 255),     // Magenta
        (7, 255, 255, 255),   // White
        (8, 128, 128, 128),   // Dark gray
        (9, 192, 192, 192),   // Light gray
        (10, 255, 0, 0),      // Red (alt)
        (30, 255, 127, 0),    // Orange
        (40, 255, 191, 0),    // Gold
        (50, 255, 255, 0),    // Yellow (alt)
        (80, 127, 255, 0),    // Lime
        (90, 0, 255, 0),      // Green (alt)
        (140, 0, 255, 255),   // Cyan (alt)
        (150, 0, 191, 255),   // Sky blue
        (170, 0, 0, 255),     // Blue (alt)
        (200, 127, 0, 255),   // Purple
        (210, 191, 0, 255),   // Violet
        (220, 255, 0, 255),   // Magenta (alt)
        (250, 50, 50, 50),    // Near black
    };

    static short NearestAci(byte r, byte g, byte b)
    {
        short best = 7;
        double bestDist = double.MaxValue;
        foreach (var (index, pr, pg, pb) in AciPalette)
        {
            double dist = Math.Pow(r - pr, 2) + Math.Pow(g - pg, 2) + Math.Pow(b - pb, 2);
            if (dist < bestDist)
            {
                bestDist = dist;
                best = index;
            }
        }
        return best;
    }

    static void ApplyColors(string inputDwg, string outputDwg, string colorsJsonPath)
    {
        // Read color map: { "LAYER_NAME": [r, g, b], ... }
        var json = File.ReadAllText(colorsJsonPath);
        var colorMap = JsonSerializer.Deserialize<Dictionary<string, int[]>>(json)!;

        CadDocument doc;
        using (var reader = new DwgReader(inputDwg))
        {
            doc = reader.Read();
        }

        foreach (var layer in doc.Layers)
        {
            if (colorMap.TryGetValue(layer.Name, out var rgb))
            {
                // ACadSharp DwgWriter doesn't persist TrueColor.
                // Map to nearest ACI index from the standard 9-color subset.
                short aci = NearestAci((byte)rgb[0], (byte)rgb[1], (byte)rgb[2]);
                layer.Color = new Color(aci);
            }
        }

        using (var writer = new DwgWriter(outputDwg, doc))
        {
            writer.Write();
        }
    }
}

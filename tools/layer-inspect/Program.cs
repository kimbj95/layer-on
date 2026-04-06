using System.Text;
using ACadSharp;
using ACadSharp.IO;
using ACadSharp.Objects;
using ACadSharp.XData;

Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

var files = new[] {
    "../../test-files/sample.dwg",
    "../../test-files/sample2.dwg"
};

foreach (var file in files)
{
    if (!File.Exists(file))
    {
        Console.WriteLine($"=== SKIP (not found): {file} ===");
        continue;
    }

    Console.WriteLine($"\n{'=',-60}");
    Console.WriteLine($"=== FILE: {file} ===");
    Console.WriteLine($"{'=',-60}");

    CadDocument doc;
    using (var reader = new DwgReader(file))
        doc = reader.Read();

    foreach (var layer in doc.Layers)
    {
        Console.WriteLine($"\n--- Layer: \"{layer.Name}\" (Handle: 0x{layer.Handle:X}) ---");

        // 1. XDictionary (Extension Dictionary)
        if (layer.XDictionary != null)
        {
            Console.WriteLine($"  XDictionary: Handle=0x{layer.XDictionary.Handle:X}, Entries={layer.XDictionary.Count()}");
            foreach (var entry in layer.XDictionary)
            {
                Console.WriteLine($"    Entry: Name=\"{entry.Name}\", Type={entry.GetType().Name}, Handle=0x{entry.Handle:X}");

                if (entry is XRecord xrec)
                {
                    Console.WriteLine($"      XRecord entries:");
                    foreach (var rec in xrec.Entries)
                    {
                        Console.WriteLine($"        Code={rec.Code}, Value=\"{rec.Value}\" ({rec.Value?.GetType().Name})");
                    }
                }
                else if (entry is CadDictionary subDict)
                {
                    Console.WriteLine($"      SubDictionary entries:");
                    foreach (var sub in subDict)
                    {
                        Console.WriteLine($"        Name=\"{sub.Name}\", Type={sub.GetType().Name}");
                        if (sub is XRecord subRec)
                        {
                            foreach (var rec in subRec.Entries)
                            {
                                Console.WriteLine($"          Code={rec.Code}, Value=\"{rec.Value}\" ({rec.Value?.GetType().Name})");
                            }
                        }
                    }
                }
            }
        }
        else
        {
            Console.WriteLine("  XDictionary: null");
        }

        // 2. ExtendedData (XDATA)
        if (layer.ExtendedData != null && layer.ExtendedData.Any())
        {
            Console.WriteLine($"  ExtendedData: {layer.ExtendedData.Count()} app(s)");
            foreach (var kvp in layer.ExtendedData)
            {
                Console.WriteLine($"    AppId: \"{kvp.Key.Name}\"");
                if (kvp.Value?.Records != null)
                {
                    foreach (var rec in kvp.Value.Records)
                    {
                        Console.WriteLine($"      Code={rec.Code}, Value=\"{rec.RawValue}\" ({rec.RawValue?.GetType().Name})");
                    }
                }
            }
        }
        else
        {
            Console.WriteLine("  ExtendedData: empty");
        }
    }
}

using ACadSharp;
using ACadSharp.IO;

class Program
{
    static int Main(string[] args)
    {
        if (args.Length < 3)
        {
            Console.Error.WriteLine("Usage: DwgConverter <to-dxf|to-dwg> <input> <output>");
            return 1;
        }

        string command = args[0];
        string input = args[1];
        string output = args[2];

        try
        {
            switch (command)
            {
                case "to-dxf":
                    ConvertToDxf(input, output);
                    break;
                case "to-dwg":
                    ConvertToDwg(input, output);
                    break;
                default:
                    Console.Error.WriteLine($"Unknown command: {command}");
                    return 1;
            }

            Console.WriteLine($"OK: {input} -> {output}");
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
}
